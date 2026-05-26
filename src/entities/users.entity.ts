import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: 'users' })
export class User {

    @PrimaryGeneratedColumn({name : 'id'})
    id!: number;

    @Column({name : 'email', type : 'varchar', unique : true})
    email!: string;

    @Column({name : 'password', type : 'varchar'})
    passwordHash!: string;

    @Column({name : 'created_on', type : 'timestamp', default : () => 'CURRENT_TIMESTAMP'})
    createdOn!: Date;

    @Column({name : 'updated_on', type : 'timestamp', nullable : true})
    updatedOn!: Date;
}