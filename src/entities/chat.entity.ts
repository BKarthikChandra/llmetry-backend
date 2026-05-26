import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./users.entity";
import { ChatMessage } from "./chat.message.entity";
import { InferenceLog } from "./inference.logs.entity";

@Entity()
export class Chat{

    @PrimaryGeneratedColumn({name : 'id'})
    id!: number;

    @Column({name : 'user_id'})
    userId!: number;

    @ManyToOne(() => User, (user) => user.chats)
    @JoinColumn({name: 'user_id'})
    user!: User;

    @Column({name : 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    createdAt!: Date;

    @Column({name : 'summary_so_far', type: 'text', nullable: true})
    summarySoFar!: string | null;

    @OneToMany(() => ChatMessage, (message) => message.chat)
    messages!: ChatMessage[];

    @OneToMany(() => InferenceLog, (log) => log.chat)
    inferenceLogs!: InferenceLog[];
}