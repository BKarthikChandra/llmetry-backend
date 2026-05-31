import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Chat } from '../../entities/chat.entity';
import { ChatMessage } from '../../entities/chat.message.entity';
import { InferenceLog } from '../../entities/inference.logs.entity';
import { Provider } from '../../entities/provider.entity';
import { ProviderModel } from '../../entities/provider.model.entity';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let chatRepository: { findOne: jest.Mock };
  let chatMessageRepository: { createQueryBuilder: jest.Mock };

  const createMessageQueryBuilder = (rows: unknown[] = []) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  });

  beforeEach(async () => {
    chatRepository = { findOne: jest.fn() };
    chatMessageRepository = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(Provider), useValue: {} },
        { provide: getRepositoryToken(ProviderModel), useValue: {} },
        { provide: getRepositoryToken(Chat), useValue: chatRepository },
        {
          provide: getRepositoryToken(ChatMessage),
          useValue: chatMessageRepository,
        },
        { provide: getRepositoryToken(InferenceLog), useValue: {} },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMessages', () => {
    it('returns messages with database-formatted createdOn values', async () => {
      const rows = [
        {
          id: 26,
          chatId: 5,
          sender: 'ai',
          content: 'Hi there!',
          createdOn: '2026-05-31T20:31:47.089Z',
          providerModelId: 1,
        },
      ];
      const qb = createMessageQueryBuilder(rows);
      chatRepository.findOne.mockResolvedValue({
        id: 5,
        userId: 7,
        isDeleted: false,
      });
      chatMessageRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(service.getMessages(7, 5)).resolves.toEqual(rows);
      expect(qb.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('to_char(message.created_on'),
        'createdOn',
      );
      expect(qb.where).toHaveBeenCalledWith('message.chatId = :chatId', {
        chatId: 5,
      });
      expect(qb.orderBy).toHaveBeenCalledWith('message.createdOn', 'ASC');
    });

    it('throws when the chat does not exist', async () => {
      chatRepository.findOne.mockResolvedValue(null);

      await expect(service.getMessages(7, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(chatMessageRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('throws when the chat belongs to another user', async () => {
      chatRepository.findOne.mockResolvedValue({
        id: 5,
        userId: 99,
        isDeleted: false,
      });

      await expect(service.getMessages(7, 5)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(chatMessageRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
