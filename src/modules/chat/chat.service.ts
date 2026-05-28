import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Provider } from '../../entities/provider.entity';
import { ProviderModel } from '../../entities/provider.model.entity';
import { Chat } from '../../entities/chat.entity';
import { ChatMessage } from '../../entities/chat.message.entity';
import { InferenceLog } from '../../entities/inference.logs.entity';
import { decrypt } from '../../common/utils/encryption.util';
import { LlmMessage } from './providers/llm-provider.interface';
import { getProvider } from './providers/provider.factory';

const CONTEXT_WINDOW = 20;

@Injectable()
export class ChatService {
    constructor(
        @InjectRepository(Provider)
        private readonly providerRepository: Repository<Provider>,
        @InjectRepository(ProviderModel)
        private readonly providerModelRepository: Repository<ProviderModel>,
        @InjectRepository(Chat)
        private readonly chatRepository: Repository<Chat>,
        @InjectRepository(ChatMessage)
        private readonly chatMessageRepository: Repository<ChatMessage>,
        @InjectRepository(InferenceLog)
        private readonly inferenceLogRepository: Repository<InferenceLog>,
    ) {}

    async sendMessage(
        userId: number,
        modelId: number,
        message: string,
        chatId?: number,
    ): Promise<{ response: string; chatId: number }> {
        // 1. Resolve model + provider (apiKey is select:false — must addSelect explicitly)
        const providerModel = await this.providerModelRepository
            .createQueryBuilder('providerModel')
            .leftJoinAndSelect('providerModel.userProvider', 'userProvider')
            .addSelect('userProvider.apiKey')
            .leftJoinAndSelect('userProvider.provider', 'provider')
            .andWhere('providerModel.id = :modelId', { modelId })
            .getOne();

        if (!providerModel) throw new NotFoundException('Model not found');
        if (providerModel.userProvider.userId !== userId)
            throw new ForbiddenException('You do not have access to this model');

        // 2. Load existing chat or create a new one
        let chat: Chat;
        let priorMessages: ChatMessage[] = [];

        if (chatId) {
            const existing = await this.chatRepository.findOne({ where: { id: chatId } });
            if (!existing) throw new NotFoundException('Chat not found');
            if (existing.userId !== userId)
                throw new ForbiddenException('You do not have access to this chat');
            chat = existing;
            priorMessages = await this.chatMessageRepository.find({
                where: { chatId },
                order: { createdAt: 'ASC' },
            });
        } else {
            chat = this.chatRepository.create({ userId });
            await this.chatRepository.save(chat);
        }

        // 3. Save the user turn immediately
        const userMessage = this.chatMessageRepository.create({
            chatId: chat.id,
            sender: 'user',
            content: message,
            providerModelId: modelId,
        });
        await this.chatMessageRepository.save(userMessage);

        // 4. Build context for the provider:
        //    [summary block if exists] + [last 20 prior messages] + [current user message]
        const windowMessages = priorMessages.slice(-CONTEXT_WINDOW);
        const messages: LlmMessage[] = [];

        if (chat.summarySoFar) {
            // Inject summary as a synthetic exchange so the model treats it as established context
            messages.push({
                role: 'user',
                content: `[Summary of earlier conversation]\n${chat.summarySoFar}`,
            });
            messages.push({
                role: 'assistant',
                content: 'Understood. I have the context from the earlier conversation.',
            });
        }

        for (const msg of windowMessages) {
            messages.push({
                role: msg.sender === 'ai' ? 'assistant' : 'user',
                content: msg.content ?? '',
            });
        }

        messages.push({ role: 'user', content: message });

        // 5. Call the provider
        const providerName = providerModel.userProvider.provider.name;
        const apiKey = decrypt(providerModel.userProvider.apiKey, process.env.ENCRYPTION_KEY!);

        const {
            text: responseText,
            inputTokens,
            outputTokens,
            totalTokens,
            latencyMs,
            status,
            errorMessage,
        } = await getProvider(providerName).chat(messages, providerModel.model, apiKey);

        // 6. Save the AI turn
        const aiMessage = this.chatMessageRepository.create({
            chatId: chat.id,
            sender: 'ai',
            content: responseText || null,
            providerModelId: modelId,
        });
        await this.chatMessageRepository.save(aiMessage);

        // 7. Save inference log
        await this.inferenceLogRepository.save(
            this.inferenceLogRepository.create({
                chatId: chat.id,
                messageId: aiMessage.id,
                provider: providerName,
                model: providerModel.model,
                inputTokens,
                outputTokens,
                totalTokens,
                latencyMs,
                status,
                errorMessage,
            }),
        );

        // 8. Rolling summarization
        //    totalMessages = priorMessages + the 2 just saved (user + AI)
        //    overflowCount = how many messages should now be in the summary
        //    If overflowCount > summarizedCount, some messages just fell off the window
        const totalMessages = priorMessages.length + 2;
        const overflowCount = Math.max(0, totalMessages - CONTEXT_WINDOW);

        if (overflowCount > chat.summarizedCount) {
            await this.rollSummary(
                chat,
                priorMessages,
                overflowCount,
                providerName,
                apiKey,
                providerModel.model,
            );
        }

        if (status === 'error') throw new Error(errorMessage!);

        return { response: responseText, chatId: chat.id };
    }

    async getMessages(userId: number, chatId: number): Promise<ChatMessage[]> {
        const chat = await this.chatRepository.findOne({ where: { id: chatId } });
        if (!chat) throw new NotFoundException('Chat not found');
        if (chat.userId !== userId) throw new ForbiddenException();

        return this.chatMessageRepository.find({
            where: { chatId },
            order: { createdAt: 'ASC' },
        });
    }

    // Summarizes messages that just fell off the sliding window and updates the chat record.
    // Only the newly overflowed slice is processed — messages already in the summary are skipped.
    private async rollSummary(
        chat: Chat,
        allPriorMessages: ChatMessage[],
        newOverflowCount: number,
        providerName: string,
        apiKey: string,
        model: string,
    ): Promise<void> {
        const newlyOverflowed = allPriorMessages.slice(chat.summarizedCount, newOverflowCount);
        if (newlyOverflowed.length === 0) return;

        const messageBlock = newlyOverflowed
            .map((m) => `${m.sender === 'ai' ? 'AI' : 'User'}: ${m.content ?? ''}`)
            .join('\n');

        const prompt = chat.summarySoFar
            ? `You are maintaining a rolling summary of a conversation.\n\nExisting summary:\n${chat.summarySoFar}\n\nNew messages to incorporate:\n${messageBlock}\n\nProduce an updated concise summary that covers the full conversation history above. Return only the summary text, no preamble.`
            : `Summarize the following conversation messages concisely. Return only the summary text, no preamble.\n\n${messageBlock}`;

        try {
            const newSummary = await getProvider(providerName).summarize(prompt, model, apiKey);
            if (newSummary) {
                chat.summarySoFar = newSummary;
                chat.summarizedCount = newOverflowCount;
                await this.chatRepository.save(chat);
            }
        } catch {
            // Summarization failure is non-fatal — the chat continues without the updated summary
        }
    }
}
