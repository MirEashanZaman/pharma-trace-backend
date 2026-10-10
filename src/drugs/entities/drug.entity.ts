import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToMany,
} from 'typeorm';

import { DrugEvent } from '../../events/entities/drug-event.entity';

@Entity('drugs')
export class Drug {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    serialNumber!: string;

    @Column()
    drugName!: string;

    @Column()
    manufacturer!: string;

    @Column()
    batchNumber!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @OneToMany(() => DrugEvent, (event) => event.drug)
    events!: DrugEvent[];
}