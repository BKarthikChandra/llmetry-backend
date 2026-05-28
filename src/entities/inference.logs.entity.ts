import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Chat } from './chat.entity';
import { ChatMessage } from './chat.message.entity';
import { Provider } from './provider.entity';
import { ProviderModel } from './provider.model.entity';

@Entity()
export class InferenceLog {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'chat_id' })
  chatId!: number;

  @ManyToOne(() => Chat, (chat) => chat.inferenceLogs)
  @JoinColumn({ name: 'chat_id' })
  chat!: Chat;

  @Column({ name: 'message_id' })
  messageId!: number;

  @ManyToOne(() => ChatMessage, (message) => message.inferenceLogs)
  @JoinColumn({ name: 'message_id' })
  message!: ChatMessage;

  @Column({ name: 'provider_id', nullable: true })
  providerId!: number | null;

  @ManyToOne(() => Provider, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'provider_id' })
  providerEntity?: Provider;

  @Column({ name: 'provider_model_id', nullable: true })
  providerModelId!: number | null;

  @ManyToOne(() => ProviderModel, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'provider_model_id' })
  providerModel?: ProviderModel;

  @Column({ name: 'provider', length: 100 })
  provider!: string;

  @Column({ name: 'model', length: 150 })
  model!: string;

  @Column({ name: 'input_tokens', type: 'int', default: 0 })
  inputTokens!: number;

  @Column({ name: 'output_tokens', type: 'int', default: 0 })
  outputTokens!: number;

  @Column({ name: 'total_tokens', type: 'int', default: 0 })
  totalTokens!: number;

  @Column({ name: 'latency_ms', type: 'int', nullable: true })
  latencyMs!: number | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
  })
  status!: 'success' | 'error';

  @Column({
    name: 'error_message',
    type: 'text',
    nullable: true,
  })
  errorMessage!: string | null;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
