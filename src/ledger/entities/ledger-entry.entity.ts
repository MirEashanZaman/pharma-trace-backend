import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('ledger_entries')
export class LedgerEntryEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Index()
    @Column()
    index!: number;

    @Index()
    @Column()
    drugSerialNumber!: string;

    @Column()
    eventId!: number;

    @Column({ length: 64 })
    eventHash!: string;

    @Column({ length: 64 })
    previousHash!: string;

    @Column({ length: 64 })
    ledgerHash!: string;

    @CreateDateColumn()
    timestamp!: Date;
}
