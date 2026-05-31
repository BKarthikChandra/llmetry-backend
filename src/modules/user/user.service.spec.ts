import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Chat } from '../../entities/chat.entity';
import { ChatMessage } from '../../entities/chat.message.entity';
import { ProviderModelCache } from '../../entities/provider.model.cache.entity';
import { ProviderModel } from '../../entities/provider.model.entity';
import { Provider } from '../../entities/provider.entity';
import { UserProvider } from '../../entities/user.provider.entity';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let chatRepository: { createQueryBuilder: jest.Mock };

  const createChatQueryBuilder = (rows: unknown[] = []) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  });

  beforeEach(async () => {
    chatRepository = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(Provider), useValue: {} },
        { provide: getRepositoryToken(UserProvider), useValue: {} },
        { provide: getRepositoryToken(ProviderModel), useValue: {} },
        { provide: getRepositoryToken(ProviderModelCache), useValue: {} },
        { provide: getRepositoryToken(Chat), useValue: chatRepository },
        { provide: getRepositoryToken(ChatMessage), useValue: {} },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserChats', () => {
    it('returns chat summaries with database-formatted timestamps', async () => {
      const rows = [
        {
          chatId: 5,
          createdOn: '2026-05-31T20:00:30.605Z',
          title: 'hi',
          lastActivityAt: '2026-05-31T20:31:47.089Z',
        },
        {
          chatId: 6,
          createdOn: '2026-05-31T21:00:30.605Z',
          title: null,
          lastActivityAt: null,
        },
      ];
      const qb = createChatQueryBuilder(rows);
      chatRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(service.getUserChats(7)).resolves.toEqual(rows);
      expect(qb.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('to_char(chat.created_on'),
        'createdOn',
      );
      expect(qb.addSelect).toHaveBeenCalledWith(
        expect.any(Function),
        'lastActivityAt',
      );
      expect(qb.where).toHaveBeenCalledWith('chat.userId = :userId', {
        userId: 7,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'chat.isDeleted = :isDeleted',
        { isDeleted: false },
      );
      expect(qb.orderBy).toHaveBeenCalledWith('lastActivityAt', 'DESC');
    });

    it('normalizes missing titles to null', async () => {
      const qb = createChatQueryBuilder([
        {
          chatId: 5,
          createdOn: '2026-05-31T20:00:30.605Z',
          lastActivityAt: null,
        },
      ]);
      chatRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(service.getUserChats(7)).resolves.toEqual([
        {
          chatId: 5,
          createdOn: '2026-05-31T20:00:30.605Z',
          title: null,
          lastActivityAt: null,
        },
      ]);
    });
  });
});
