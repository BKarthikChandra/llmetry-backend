import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Chat } from "./chat.entity";
import { UserProvider } from "./user.provider.entity";

@Entity({ name: 'users' })
export class User {

    @PrimaryGeneratedColumn({name : 'id'})
    id!: number;

    @Column({name : 'email', type : 'varchar', unique : true})
    email!: string;

    @Column({name : 'password', type : 'varchar', select : false})
    passwordHash!: string;

    @Column({name : 'created_on', type : 'timestamp', default : () => 'CURRENT_TIMESTAMP'})
    createdOn!: Date;

    @Column({name : 'updated_on', type : 'timestamp', nullable : true})
    updatedOn!: Date;

    @OneToMany(() => Chat, (chat) => chat.user)
    chats!: Chat[];

    @OneToMany(() => UserProvider, (userProvider) => userProvider.user)
    userProviders!: UserProvider[];
}