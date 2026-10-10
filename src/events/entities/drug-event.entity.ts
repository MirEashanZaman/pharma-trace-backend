import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
} from 'typeorm';

import { Drug } from '../../drugs/entities/drug.entity';
import { EventType } from '../event-type.enum';

@Entity('drug_events')
export class DrugEvent {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    drugSerialNumber!: string;

    @Column({
        type: 'enum',
        enum: EventType,
    })
    eventType!: EventType;

    @Column({ type: 'json' })
    eventData!: Record<string, any>;

    @Column({ length: 64, nullable: true })
    eventHash!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @ManyToOne(() => Drug, (drug) => drug.events)
    drug!: Drug;
}