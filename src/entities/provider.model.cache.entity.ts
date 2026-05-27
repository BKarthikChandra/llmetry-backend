import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Provider } from './provider.entity';

@Entity({ name: 'provider_model_cache' })
export class ProviderModelCache {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'provider_id', unique: true })
  providerId!: number;

  @ManyToOne(() => Provider)
  @JoinColumn({ name: 'provider_id' })
  provider!: Provider;

  @Column({ name: 'models', type: 'jsonb' })
  models!: string[];

  @Column({ name: 'cached_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  cachedAt!: Date;
}
