import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Provider } from '../../entities/provider.entity';
import { ProviderModel } from '../../entities/provider.model.entity';
import { ProviderModelCache } from '../../entities/provider.model.cache.entity';
import { UserProvider } from '../../entities/user.provider.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([Provider, UserProvider, ProviderModel, ProviderModelCache])],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
