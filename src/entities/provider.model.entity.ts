import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserProvider } from './user.provider.entity';
import { ChatMessage } from './chat.message.entity';

@Entity()
@Unique(['userProviderId', 'model'])
export class ProviderModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'user_provider_id' })
  userProviderId!: number;

  @ManyToOne(() => UserProvider, (userProvider) => userProvider.providerModels)
  @JoinColumn({ name: 'user_provider_id' })
  userProvider!: UserProvider;

  @Column({ name: 'model', type: 'varchar' })
  model!: string;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @OneToMany(() => ChatMessage, (message) => message.providerModel)
  chatMessages!: ChatMessage[];
}
