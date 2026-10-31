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

    @Column({ nullable: true })
    dosageForm?: string;

    @Column({ nullable: true })
    strength?: string;

    @Column({ nullable: true })
    expiryDate?: string;

    @Column({ nullable: true })
    apiSupplier?: string;

    @Column({ nullable: true })
    apiCasNumber?: string;

    @Column({ nullable: true })
    rawMaterialLot?: string;

    @Column({ default: 'IN_PRODUCTION' })
    qcStatus!: string;

    @Column({ type: 'float', nullable: true })
    qcPurityPercentage?: number;

    @Column({ type: 'float', nullable: true })
    qcPhLevel?: number;

    @Column({ nullable: true })
    qcEndotoxinLimit?: string;

    @Column({ nullable: true })
    qcCertHash?: string;

    @Column({ nullable: true })
    qcSignedBy?: string;

    @Column({ nullable: true })
    qcSignedAt?: Date;

    @Column({ nullable: true })
    carrierName?: string;

    @Column({ nullable: true })
    sealNumber?: string;

    @Column({ default: false })
    isRecalled!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @OneToMany(() => DrugEvent, (event) => event.drug)
    events!: DrugEvent[];
}
