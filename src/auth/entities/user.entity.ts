import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
    ADMIN = 'ADMIN',
    MANUFACTURER = 'MANUFACTURER',
    DISTRIBUTOR = 'DISTRIBUTOR',
    PHARMACY = 'PHARMACY',
    REGULATOR = 'REGULATOR',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    email!: string;

    @Column({ nullable: true })
    password?: string;

    @Column({ nullable: true })
    fullName?: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.MANUFACTURER,
    })
    role!: UserRole;

    @Column({ nullable: true, unique: true })
    walletAddress?: string;

    @Column({ nullable: true })
    organization?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
