import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';
import { UserRole } from './user.entity';

@Entity('invitations')
export class Invitation {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    token!: string;

    @Column()
    organizationName!: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.MANUFACTURER,
    })
    assignedRole!: UserRole;

    @Column({ nullable: true })
    recipientEmail?: string;

    @Column({ default: false })
    isClaimed!: boolean;

    @Column({ nullable: true })
    claimedByEmail?: string;

    @Column()
    expiresAt!: Date;

    @Column({ nullable: true })
    createdById?: number;

    @CreateDateColumn()
    createdAt!: Date;
}
