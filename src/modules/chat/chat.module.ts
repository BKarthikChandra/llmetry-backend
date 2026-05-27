import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Provider } from '../../entities/provider.entity';
import { UserProvider } from '../../entities/user.provider.entity';
import { ProviderModel } from '../../entities/provider.model.entity';
import { ProviderModelCache } from '../../entities/provider.model.cache.entity';
import { Chat } from '../../entities/chat.entity';
import { ChatMessage } from '../../entities/chat.message.entity';
import { InferenceLog } from '../../entities/inference.logs.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Provider,
      UserProvider,
      ProviderModel,
      ProviderModelCache,
      Chat,
      ChatMessage,
      InferenceLog,
    ]),
  ],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
