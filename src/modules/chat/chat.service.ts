import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Provider } from '../../entities/provider.entity';
import { UserProvider } from '../../entities/user.provider.entity';
import { ProviderModel } from '../../entities/provider.model.entity';
import { Chat } from '../../entities/chat.entity';
import { ChatMessage } from '../../entities/chat.message.entity';
import { InferenceLog } from '../../entities/inference.logs.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenAI } from '@google/genai';
import { decrypt } from '../../common/utils/encryption.util';

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

    async sendMessage(userId: number, modelId: number, message: string): Promise<{ response: string }> {
        const providerModel = await this.providerModelRepository
            .createQueryBuilder('providerModel')
            .leftJoinAndSelect('providerModel.userProvider', 'userProvider')
            .addSelect('userProvider.apiKey')
            .leftJoinAndSelect('userProvider.provider', 'provider')
            .andWhere('providerModel.id = :modelId', { modelId })
            .getOne();

        if (!providerModel) {
            throw new NotFoundException('Model not found');
        }

        if (providerModel.userProvider.userId !== userId) {
            throw new ForbiddenException('You do not have access to this model');
        }

        const chat = this.chatRepository.create({ userId });
        await this.chatRepository.save(chat);

        const userMessage = this.chatMessageRepository.create({
            chatId: chat.id,
            sender: 'user',
            content: message,
            providerModelId: modelId,
        });
        await this.chatMessageRepository.save(userMessage);

        const providerName = providerModel.userProvider.provider.name;
        const apiKey = decrypt(providerModel.userProvider.apiKey, process.env.ENCRYPTION_KEY!);
        const startTime = Date.now();

        let responseText = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let totalTokens = 0;
        let status: 'success' | 'error' = 'success';
        let errorMessage: string | null = null;

        try {
            if (providerName === 'gemini') {
                const ai = new GoogleGenAI({ apiKey });
                const result = await ai.models.generateContent({
                    model: `models/${providerModel.model}`,
                    contents: message,
                });
                responseText = result.text ?? '';
                inputTokens = result.usageMetadata?.promptTokenCount ?? 0;
                outputTokens = result.usageMetadata?.candidatesTokenCount ?? 0;
                totalTokens = result.usageMetadata?.totalTokenCount ?? 0;
            } else {
                throw new Error(`Provider '${providerName}' is not yet supported`);
            }
        } catch (err) {
            status = 'error';
            errorMessage = (err as Error).message;
        }

        const latencyMs = Date.now() - startTime;

        const aiMessage = this.chatMessageRepository.create({
            chatId: chat.id,
            sender: 'ai',
            content: responseText || null,
            providerModelId: modelId,
        });
        await this.chatMessageRepository.save(aiMessage);

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

        if (status === 'error') {
            throw new Error(errorMessage!);
        }

        return { response: responseText };
    }
}
