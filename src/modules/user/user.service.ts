import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider } from '../../entities/provider.entity';
import { UserProvider } from '../../entities/user.provider.entity';
import { ProviderModel } from '../../entities/provider.model.entity';
import { ProviderModelCache } from '../../entities/provider.model.cache.entity';
import { encrypt, decrypt } from '../../common/utils/encryption.util';
import {
  AddModelDto,
  ProviderDto,
  ProviderModelDto,
  RegisteredProviderDto,
  RegisterProviderDto,
} from './dto/user.dto';

const CACHE_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly memoryCache = new Map<
    number,
    { models: string[]; cachedAt: number }
  >();

  constructor(
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
    @InjectRepository(UserProvider)
    private userProviderRepository: Repository<UserProvider>,
    @InjectRepository(ProviderModel)
    private providerModelRepository: Repository<ProviderModel>,
    @InjectRepository(ProviderModelCache)
    private cacheRepository: Repository<ProviderModelCache>,
  ) {}

  async getProviders(): Promise<ProviderDto[]> {
    this.logger.log('Fetching all providers');
    const providers = await this.providerRepository.find();
    this.logger.log(`Returning ${providers.length} providers`);
    return providers.map((p) => ({ id: p.id, displayName: p.displayName }));
  }

  async registerProvider(
    userId: number,
    providerId: number,
    dto: RegisterProviderDto,
  ): Promise<{ message: string }> {
    this.logger.log(`User ${userId} registering provider ${providerId}`);

    const existing = await this.userProviderRepository.findOne({
      where: { userId, providerId },
    });

    if (existing) {
      this.logger.warn(
        `User ${userId} already registered provider ${providerId}`,
      );
      throw new ConflictException('Provider already registered');
    }

    const encryptedKey = encrypt(dto.apiKey, process.env.ENCRYPTION_KEY!);

    await this.userProviderRepository.save(
      this.userProviderRepository.create({
        userId,
        providerId,
        apiKey: encryptedKey,
      }),
    );

    this.logger.log(
      `User ${userId} successfully registered provider ${providerId}`,
    );
    return { message: 'Provider registered successfully' };
  }

  async getRegisteredProviders(
    userId: number,
  ): Promise<RegisteredProviderDto[]> {
    this.logger.log(`Fetching registered providers for user ${userId}`);
    const records = await this.userProviderRepository.find({
      where: { userId },
      relations: { provider: true },
    });
    this.logger.log(
      `User ${userId} has ${records.length} registered provider(s)`,
    );
    return records.map((up) => ({
      id: up.id,
      name: up.provider.name,
      displayName: up.provider.displayName,
      registeredAt: up.createdAt,
    }));
  }

  async getModels(
    userId: number,
    providerId: number,
  ): Promise<ProviderModelDto[]> {
    this.logger.log(
      `Fetching configured models for user ${userId}, provider ${providerId}`,
    );

    const userProvider = await this.userProviderRepository.findOne({
      where: { userId, providerId },
    });

    if (!userProvider) {
      this.logger.warn(
        `User ${userId} has not registered provider ${providerId}`,
      );
      throw new NotFoundException(
        'Provider not registered. Register the provider first.',
      );
    }

    const models = await this.providerModelRepository.find({
      where: { userProviderId: userProvider.id },
    });

    this.logger.log(
      `Found ${models.length} configured model(s) for user ${userId}, provider ${providerId}`,
    );
    return models.map((m) => ({
      id: m.id,
      model: m.model,
      createdAt: m.createdAt,
    }));
  }

  async addModel(
    userId: number,
    providerId: number,
    dto: AddModelDto,
  ): Promise<ProviderModel> {
    this.logger.log(
      `User ${userId} adding model '${dto.model}' for provider ${providerId}`,
    );

    const userProvider = await this.userProviderRepository
      .createQueryBuilder('up')
      .addSelect('up.apiKey')
      .leftJoinAndSelect('up.provider', 'provider')
      .where('up.userId = :userId AND up.providerId = :providerId', {
        userId,
        providerId,
      })
      .getOne();

    if (!userProvider) {
      this.logger.warn(
        `User ${userId} has not registered provider ${providerId}`,
      );
      throw new NotFoundException(
        'Provider not registered. Register the provider first.',
      );
    }

    const models = await this.getModelsWithCache(userProvider);

    if (!models.includes(dto.model)) {
      this.logger.warn(
        `User ${userId} requested invalid model '${dto.model}' for provider ${providerId}`,
      );
      throw new BadRequestException({
        message: `Invalid model '${dto.model}'`,
        availableModels: models,
      });
    }

    const existing = await this.providerModelRepository.findOne({
      where: { userProviderId: userProvider.id, model: dto.model },
    });
    if (existing) {
      this.logger.warn(
        `Model '${dto.model}' already configured for user ${userId}, provider ${providerId}`,
      );
      throw new ConflictException(`Model '${dto.model}' is already configured`);
    }

    const saved = await this.providerModelRepository.save(
      this.providerModelRepository.create({
        userProviderId: userProvider.id,
        model: dto.model,
      }),
    );
    this.logger.log(
      `Model '${dto.model}' successfully added for user ${userId}, provider ${providerId}`,
    );
    return saved;
  }

  private async getModelsWithCache(
    userProvider: UserProvider,
  ): Promise<string[]> {
    const { providerId } = userProvider;
    const now = Date.now();

    // L1: in-memory
    const mem = this.memoryCache.get(providerId);
    if (mem && now - mem.cachedAt < CACHE_TTL_MS) {
      this.logger.debug(`Cache L1 hit for provider ${providerId}`);
      return mem.models;
    }

    // L2: DB
    const cached = await this.cacheRepository.findOne({
      where: { providerId },
    });
    if (cached && now - cached.cachedAt.getTime() < CACHE_TTL_MS) {
      this.logger.debug(
        `Cache L2 hit for provider ${providerId}, populating L1`,
      );
      this.memoryCache.set(providerId, {
        models: cached.models,
        cachedAt: cached.cachedAt.getTime(),
      });
      return cached.models;
    }

    // L3: live fetch from provider
    this.logger.log(
      `Cache miss for provider ${providerId}, fetching from provider API`,
    );
    const apiKey = decrypt(userProvider.apiKey, process.env.ENCRYPTION_KEY!);
    const models = await this.fetchModelsFromProvider(
      userProvider.provider.name,
      apiKey,
    );

    await this.cacheRepository.upsert(
      { providerId, models, cachedAt: new Date() },
      ['providerId'],
    );
    this.memoryCache.set(providerId, { models, cachedAt: now });
    this.logger.log(
      `Fetched and cached ${models.length} models for provider ${providerId}`,
    );

    return models;
  }

  private async fetchModelsFromProvider(
    providerName: string,
    apiKey: string,
  ): Promise<string[]> {
    this.logger.log(`Fetching models from provider '${providerName}'`);
    try {
      switch (providerName) {
        case 'openai': {
          const res = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!res.ok) throw new Error('upstream error');
          const data = (await res.json()) as { data: { id: string }[] };
          return data.data.map((m) => m.id);
        }
        case 'claude': {
          const res = await fetch('https://api.anthropic.com/v1/models', {
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          });
          if (!res.ok) throw new Error('upstream error');
          const data = (await res.json()) as { data: { id: string }[] };
          return data.data.map((m) => m.id);
        }
        case 'gemini': {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          );
          if (!res.ok) throw new Error('upstream error');
          const data = (await res.json()) as { models: { name: string }[] };
          return data.models.map((m) => m.name.replace('models/', ''));
        }
        case 'deepseek': {
          const res = await fetch('https://api.deepseek.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!res.ok) throw new Error('upstream error');
          const data = (await res.json()) as { data: { id: string }[] };
          return data.data.map((m) => m.id);
        }
        case 'copilot':
          return [
            'gpt-4o',
            'gpt-4o-mini',
            'claude-3.5-sonnet',
            'o1-preview',
            'o1-mini',
          ];
        default:
          throw new BadRequestException(`Unknown provider: ${providerName}`);
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(
        `Failed to fetch models from provider '${providerName}'`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException(
        'Failed to fetch models from provider. Verify your API key.',
      );
    }
  }
}
