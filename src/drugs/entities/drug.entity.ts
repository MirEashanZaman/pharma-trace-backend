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

    @Column({ nullable: true })
    currentCustodian?: string;

    @Column({ nullable: true })
    custodyLocation?: string;

    @Column({ default: 'PENDING_INBOUND' })
    inboundInspectionStatus!: string;

    @Column({ type: 'float', nullable: true })
    inboundInspectionTemp?: number;

    @Column({ nullable: true })
    inboundInspectionNotes?: string;

    @Column({ nullable: true })
    inboundInspectedBy?: string;

    @Column({ nullable: true })
    inboundInspectedAt?: Date;

    @Column({ nullable: true })
    assignedVehicleId?: string;

    @Column({ nullable: true })
    storageZone?: string;

    @Column({ nullable: true })
    targetPharmacy?: string;

    @Column({ nullable: true })
    outboundManifestId?: string;

    @Column({ nullable: true })
    deliveryProofSignature?: string;

    @Column({ nullable: true })
    deliveryProofReceivedBy?: string;

    @Column({ nullable: true })
    deliveryProofDeliveredAt?: Date;

    @Column({ default: 'PENDING_PHARMACY' })
    pharmacyInboundStatus!: string;

    @Column({ type: 'float', nullable: true })
    pharmacyInboundTemp?: number;

    @Column({ nullable: true })
    pharmacyInboundNotes?: string;

    @Column({ nullable: true })
    pharmacyInboundPharmacist?: string;

    @Column({ nullable: true })
    pharmacyInboundLicense?: string;

    @Column({ nullable: true })
    pharmacyInboundAt?: Date;

    @Column({ nullable: true })
    pharmacyStorageLocation?: string;

    @Column({ nullable: true })
    prescriptionNumber?: string;

    @Column({ nullable: true })
    prescribingDoctor?: string;

    @Column({ nullable: true })
    patientToken?: string;

    @Column({ nullable: true })
    dispensedByPharmacist?: string;

    @Column({ nullable: true })
    dispensedAt?: Date;

    @Column({ nullable: true })
    dispenseNotes?: string;

    @Column({ nullable: true })
    destructionCertificateId?: string;

    @Column({ nullable: true })
    destructionReason?: string;

    @Column({ nullable: true })
    destructionWitness?: string;

    @Column({ nullable: true })
    destroyedAt?: Date;

    @Column({ nullable: true })
    returnReason?: string;

    @Column({ nullable: true })
    returnedToDistributorAt?: Date;

    @Column({ default: 'NONE' })
    recallClass!: string;

    @Column({ nullable: true })
    recallDirectiveRef?: string;

    @Column({ nullable: true })
    recallAuthority?: string;

    @Column({ nullable: true })
    recallReason?: string;

    @Column({ nullable: true })
    recallIssuedAt?: Date;

    @Column({ nullable: true })
    regulatoryInvestigationDocket?: string;

    @Column({ default: 'NOT_UNDER_INVESTIGATION' })
    regulatoryInvestigationStatus!: string;

    @Column({ nullable: true })
    regulatoryForensicNotes?: string;

    @Column({ nullable: true })
    regulatoryAssayFinding?: string;

    @Column({ nullable: true })
    inspectionObservationRef?: string;

    @Column({ default: 'NOT_INSPECTED' })
    inspectionDisposition!: string;

    @Column({ nullable: true })
    inspectionCitation?: string;

    @Column({ nullable: true })
    inspectedInspectorBadge?: string;

    @Column({ nullable: true })
    inspectedFacility?: string;

    @Column({ nullable: true })
    adeReportId?: string;

    @Column({ nullable: true })
    adeSeverity?: string;

    @Column({ nullable: true })
    adeReactionDetails?: string;

    @Column({ nullable: true })
    adeReportedAt?: Date;

    @CreateDateColumn()
    createdAt!: Date;

    @OneToMany(() => DrugEvent, (event) => event.drug)
    events!: DrugEvent[];
}
