import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
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
  RegisteredProviderDto,
  RegisterProviderDto,
} from './dto/user.dto';

const CACHE_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class UserService {
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
    const providers = await this.providerRepository.find();
    return providers.map((p) => ({ id: p.id, displayName: p.displayName }));
  }

  async registerProvider(
    userId: number,
    providerId: number,
    dto: RegisterProviderDto,
  ): Promise<void> {
    const existing = await this.userProviderRepository.findOne({
      where: { userId, providerId },
    });
    if (existing) {
      throw new ConflictException('Provider already registered');
    }

    const encryptedKey = encrypt(dto.apiKey, process.env.ENCRYPTION_KEY!);
    await this.userProviderRepository.save(
      this.userProviderRepository.create({ userId, providerId, apiKey: encryptedKey }),
    );
  }

  async getRegisteredProviders(userId: number): Promise<RegisteredProviderDto[]> {
    const records = await this.userProviderRepository.find({
      where: { userId },
      relations: { provider: true },
    });
    return records.map((up) => ({
      id: up.id,
      name: up.provider.name,
      displayName: up.provider.displayName,
      registeredAt: up.createdAt,
    }));
  }

  async addModel(userId: number, providerId: number, dto: AddModelDto): Promise<ProviderModel> {
    const userProvider = await this.userProviderRepository
      .createQueryBuilder('up')
      .addSelect('up.apiKey')
      .leftJoinAndSelect('up.provider', 'provider')
      .where('up.userId = :userId AND up.providerId = :providerId', { userId, providerId })
      .getOne();

    if (!userProvider) {
      throw new NotFoundException('Provider not registered. Register the provider first.');
    }

    const models = await this.getModelsWithCache(userProvider);

    if (!models.includes(dto.model)) {
      throw new BadRequestException({
        message: `Invalid model '${dto.model}'`,
        availableModels: models,
      });
    }

    const existing = await this.providerModelRepository.findOne({
      where: { userProviderId: userProvider.id, model: dto.model },
    });
    if (existing) {
      throw new ConflictException(`Model '${dto.model}' is already configured`);
    }

    return this.providerModelRepository.save(
      this.providerModelRepository.create({ userProviderId: userProvider.id, model: dto.model }),
    );
  }

  private async getModelsWithCache(userProvider: UserProvider): Promise<string[]> {
    const cached = await this.cacheRepository.findOne({
      where: { providerId: userProvider.providerId },
    });

    if (cached && Date.now() - cached.cachedAt.getTime() < CACHE_TTL_MS) {
      return cached.models;
    }

    const apiKey = decrypt(userProvider.apiKey, process.env.ENCRYPTION_KEY!);
    const models = await this.fetchModelsFromProvider(userProvider.provider.name, apiKey);

    await this.cacheRepository.upsert(
      { providerId: userProvider.providerId, models, cachedAt: new Date() },
      ['providerId'],
    );

    return models;
  }

  private async fetchModelsFromProvider(
    providerName: string,
    apiKey: string,
  ): Promise<string[]> {
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
          return ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'o1-preview', 'o1-mini'];
        default:
          throw new BadRequestException(`Unknown provider: ${providerName}`);
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadGatewayException(
        'Failed to fetch models from provider. Verify your API key.',
      );
    }
  }
}
