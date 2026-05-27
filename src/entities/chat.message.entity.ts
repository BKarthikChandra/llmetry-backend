import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Chat } from './chat.entity';
import { InferenceLog } from './inference.logs.entity';
import { ProviderModel } from './provider.model.entity';

@Entity()
export class ChatMessage {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'chat_id' })
  chatId!: number;

  @ManyToOne(() => Chat, (chat) => chat.messages)
  @JoinColumn({ name: 'chat_id' })
  chat!: Chat;

  @Column({ name: 'sender', type: 'enum', enum: ['user', 'ai'] })
  sender!: 'user' | 'ai';

  @Column({ name: 'content', type: 'text', nullable: true })
  content!: string | null;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @Column({ name: 'provider_model_id', nullable: true })
  providerModelId!: number | null;

  @ManyToOne(() => ProviderModel, (providerModel) => providerModel.chatMessages)
  @JoinColumn({ name: 'provider_model_id' })
  providerModel!: ProviderModel | null;

  @OneToMany(() => InferenceLog, (log) => log.message)
  inferenceLogs!: InferenceLog[];
}
