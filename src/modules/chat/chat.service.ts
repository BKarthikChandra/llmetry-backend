import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Provider } from '../../entities/provider.entity';
import { ProviderModel } from '../../entities/provider.model.entity';
import { Chat } from '../../entities/chat.entity';
import { ChatMessage } from '../../entities/chat.message.entity';
import { InferenceLog } from '../../entities/inference.logs.entity';
import { decrypt } from '../../common/utils/encryption.util';
import { ChatMessageDto } from './dto/chat-message.dto';
import { LlmMessage } from './providers/llm-provider.interface';
import { getProvider } from './providers/provider.factory';

const CONTEXT_WINDOW = 20;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

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
    this.logger.log(
      `sendMessage — user ${userId}, modelId ${modelId}, chatId ${chatId ?? 'new'}`,
    );

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

    if (chatId !== undefined) {
      const existing = await this.chatRepository.findOne({
        where: { id: chatId, isDeleted: false },
      });
      if (!existing) throw new NotFoundException('Chat not found');
      if (existing.userId !== userId)
        throw new ForbiddenException('You do not have access to this chat');
      chat = existing;
      priorMessages = await this.chatMessageRepository.find({
        where: { chatId },
        order: { createdOn: 'ASC' },
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
    // Drop trailing user turns — they're dangling from prior errored requests where
    // no AI message was saved. Gemini and Claude reject consecutive user turns.
    while (
      windowMessages.length > 0 &&
      windowMessages[windowMessages.length - 1].sender === 'user'
    ) {
      windowMessages.pop();
    }
    const messages: LlmMessage[] = [];

    if (chat.summarySoFar) {
      // Inject summary as a synthetic exchange so the model treats it as established context
      messages.push({
        role: 'user',
        content: `[Summary of earlier conversation]\n${chat.summarySoFar}`,
      });
      messages.push({
        role: 'assistant',
        content:
          'Understood. I have the context from the earlier conversation.',
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
    this.logger.log(
      `Calling provider '${providerName}' model '${providerModel.model}' for chat ${chat.id}`,
    );
    const apiKey = decrypt(
      providerModel.userProvider.apiKey,
      process.env.ENCRYPTION_KEY!,
    );

    const {
      text: responseText,
      inputTokens,
      outputTokens,
      totalTokens,
      latencyMs,
      status,
      errorMessage,
    } = await getProvider(providerName).chat(
      messages,
      providerModel.model,
      apiKey,
    );

    this.logger.log(
      `Provider '${providerName}' responded status='${status}' latency=${latencyMs}ms tokens=${totalTokens} for chat ${chat.id}`,
    );
    if (status === 'error') {
      this.logger.warn(`Provider error for chat ${chat.id}: ${errorMessage}`);
    }

    // 6. Save the AI turn only when the provider returned a response.
    //    On error there is no content to persist, and skipping the save prevents
    //    a null-content ghost message from appearing in the chat history.
    let aiMessageId: number | null = null;
    if (status === 'success') {
      const aiMessage = this.chatMessageRepository.create({
        chatId: chat.id,
        sender: 'ai',
        content: responseText || null,
        providerModelId: modelId,
      });
      await this.chatMessageRepository.save(aiMessage);
      aiMessageId = aiMessage.id;
    }

    // 7. Save inference log — always written regardless of success/error so
    //    the analytics dashboards capture failed calls too.
    await this.inferenceLogRepository.save(
      this.inferenceLogRepository.create({
        chatId: chat.id,
        messageId: aiMessageId,
        providerId: providerModel.userProvider.providerId,
        providerModelId: modelId,
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

    if (status === 'error') throw new BadGatewayException(errorMessage);

    return { response: responseText, chatId: chat.id };
  }

  async sendMessageStream(
    userId: number,
    modelId: number,
    message: string,
    chatId: number | undefined,
    onChunk: (chunk: string) => void,
  ): Promise<{
    chatId: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
  }> {
    this.logger.log(
      `sendMessageStream — user ${userId}, modelId ${modelId}, chatId ${chatId ?? 'new'}`,
    );

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

    if (chatId !== undefined) {
      const existing = await this.chatRepository.findOne({
        where: { id: chatId, isDeleted: false },
      });
      if (!existing) throw new NotFoundException('Chat not found');
      if (existing.userId !== userId)
        throw new ForbiddenException('You do not have access to this chat');
      chat = existing;
      priorMessages = await this.chatMessageRepository.find({
        where: { chatId },
        order: { createdOn: 'ASC' },
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

    // 4. Build context for the provider
    const windowMessages = priorMessages.slice(-CONTEXT_WINDOW);
    while (
      windowMessages.length > 0 &&
      windowMessages[windowMessages.length - 1].sender === 'user'
    ) {
      windowMessages.pop();
    }
    const llmMessages: LlmMessage[] = [];

    if (chat.summarySoFar) {
      llmMessages.push({
        role: 'user',
        content: `[Summary of earlier conversation]\n${chat.summarySoFar}`,
      });
      llmMessages.push({
        role: 'assistant',
        content: 'Understood. I have the context from the earlier conversation.',
      });
    }

    for (const msg of windowMessages) {
      llmMessages.push({
        role: msg.sender === 'ai' ? 'assistant' : 'user',
        content: msg.content ?? '',
      });
    }

    llmMessages.push({ role: 'user', content: message });

    // 5. Stream from the provider
    const providerName = providerModel.userProvider.provider.name;
    this.logger.log(
      `Streaming from provider '${providerName}' model '${providerModel.model}' for chat ${chat.id}`,
    );
    const apiKey = decrypt(
      providerModel.userProvider.apiKey,
      process.env.ENCRYPTION_KEY!,
    );

    const {
      text: responseText,
      inputTokens,
      outputTokens,
      totalTokens,
      latencyMs,
      status,
      errorMessage,
    } = await getProvider(providerName).chatStream(
      llmMessages,
      providerModel.model,
      apiKey,
      onChunk,
    );

    this.logger.log(
      `Provider '${providerName}' stream done status='${status}' latency=${latencyMs}ms tokens=${totalTokens} for chat ${chat.id}`,
    );
    if (status === 'error') {
      this.logger.warn(
        `Provider stream error for chat ${chat.id}: ${errorMessage}`,
      );
    }

    // 6. Save the AI turn only on success
    let aiMessageId: number | null = null;
    if (status === 'success') {
      const aiMessage = this.chatMessageRepository.create({
        chatId: chat.id,
        sender: 'ai',
        content: responseText || null,
        providerModelId: modelId,
      });
      await this.chatMessageRepository.save(aiMessage);
      aiMessageId = aiMessage.id;
    }

    // 7. Save inference log
    await this.inferenceLogRepository.save(
      this.inferenceLogRepository.create({
        chatId: chat.id,
        messageId: aiMessageId,
        providerId: providerModel.userProvider.providerId,
        providerModelId: modelId,
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
    const totalMessageCount = priorMessages.length + 2;
    const overflowCount = Math.max(0, totalMessageCount - CONTEXT_WINDOW);

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

    if (status === 'error') throw new BadGatewayException(errorMessage);

    return { chatId: chat.id, inputTokens, outputTokens, totalTokens, latencyMs };
  }

  async getMessages(userId: number, chatId: number): Promise<ChatMessageDto[]> {
    this.logger.log(`getMessages — user ${userId}, chatId ${chatId}`);
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, isDeleted: false },
    });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.userId !== userId) throw new ForbiddenException();

    return this.chatMessageRepository
      .createQueryBuilder('message')
      .select('message.id', 'id')
      .addSelect('message.chatId', 'chatId')
      .addSelect('message.sender', 'sender')
      .addSelect('message.content', 'content')
      .addSelect(
        `to_char(message.created_on, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
        'createdOn',
      )
      .addSelect('message.providerModelId', 'providerModelId')
      .where('message.chatId = :chatId', { chatId })
      .orderBy('message.createdOn', 'ASC')
      .getRawMany<ChatMessageDto>();
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
    const newlyOverflowed = allPriorMessages.slice(
      chat.summarizedCount,
      newOverflowCount,
    );
    if (newlyOverflowed.length === 0) return;

    const messageBlock = newlyOverflowed
      .map((m) => `${m.sender === 'ai' ? 'AI' : 'User'}: ${m.content ?? ''}`)
      .join('\n');

    const prompt = chat.summarySoFar
      ? `You are maintaining a rolling summary of a conversation.\n\nExisting summary:\n${chat.summarySoFar}\n\nNew messages to incorporate:\n${messageBlock}\n\nProduce an updated concise summary that covers the full conversation history above. Return only the summary text, no preamble.`
      : `Summarize the following conversation messages concisely. Return only the summary text, no preamble.\n\n${messageBlock}`;

    try {
      const newSummary = await getProvider(providerName).summarize(
        prompt,
        model,
        apiKey,
      );
      if (newSummary) {
        chat.summarySoFar = newSummary;
        chat.summarizedCount = newOverflowCount;
        await this.chatRepository.save(chat);
      }
    } catch (err) {
      this.logger.warn(
        `Rolling summarization failed for chat ${chat.id}: ${(err as Error).message}`,
      );
    }
  }

  async deleteChat(
    userId: number,
    chatId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`deleteChat — user ${userId}, chatId ${chatId}`);
    const chat = await this.chatRepository.findOne({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.userId !== userId) throw new ForbiddenException();

    // Soft delete: mark the chat as deleted without removing records from the database
    chat.isDeleted = true;
    await this.chatRepository.save(chat);
    return { message: 'Chat deleted successfully' };
  }
}
