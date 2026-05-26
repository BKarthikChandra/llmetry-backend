import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";
import { User } from "./users.entity";
import { ProviderModel } from "./provider.model.entity";

@Entity()
@Unique(['userId', 'provider'])
export class UserProvider {

    @PrimaryGeneratedColumn({name: 'id'})
    id!: number;

    @Column({name: 'user_id'})
    userId!: number;

    @ManyToOne(() => User, (user) => user.userProviders)
    @JoinColumn({name: 'user_id'})
    user!: User;

    @Column({name: 'provider', type: 'enum', enum: ['gemini', 'openai', 'anthropic']})
    provider!: 'gemini' | 'openai' | 'anthropic';

    @Column({name: 'api_key', type: 'varchar', select: false})
    apiKey!: string;

    @Column({name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    createdAt!: Date;

    @OneToMany(() => ProviderModel, (providerModel) => providerModel.userProvider)
    providerModels!: ProviderModel[];
}
