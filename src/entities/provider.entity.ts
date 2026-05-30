import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserProvider } from './user.provider.entity';

@Entity({ name: 'provider' })
export class Provider {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'name', type: 'varchar', unique: true })
  name!: string;

  @Column({ name: 'display_name', type: 'varchar' })
  displayName!: string;

  @Column({
    name: 'created_on',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdOn!: Date;

  @OneToMany(() => UserProvider, (userProvider) => userProvider.provider)
  userProviders!: UserProvider[];
}
