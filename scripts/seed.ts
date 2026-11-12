import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../src/auth/entities/user.entity';
import { Drug } from '../src/drugs/entities/drug.entity';
import { DrugEvent } from '../src/events/entities/drug-event.entity';
import { EventType } from '../src/events/event-type.enum';
import { createHash } from 'crypto';

async function seed() {
    console.log('Seeding Database with Default Accounts & Genesis Batches...');

    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || '12345',
        database: process.env.DB_NAME || 'pharma_trace',
        entities: [User, Drug, DrugEvent],
        synchronize: true,
    });

    await dataSource.initialize();
    console.log('Connected to PostgreSQL Database.');

    const userRepo = dataSource.getRepository(User);
    const drugRepo = dataSource.getRepository(Drug);
    const eventRepo = dataSource.getRepository(DrugEvent);

    const defaultPassword = await bcrypt.hash('123456', 10);

    const usersToSeed = [
        {
            email: 'admin@pharma.com',
            password: defaultPassword,
            fullName: 'System Administrator',
            role: UserRole.ADMIN,
            organization: 'PharmaTrace Governance',
            walletAddress: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
        },
        {
            email: 'manufacturer@pharma.com',
            password: defaultPassword,
            fullName: 'Novartis Production Lead',
            role: UserRole.MANUFACTURER,
            organization: 'Novartis Global',
            walletAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        },
        {
            email: 'distributor@pharma.com',
            password: defaultPassword,
            fullName: 'DHL Cold-Chain Logistics',
            role: UserRole.DISTRIBUTOR,
            organization: 'DHL Healthcare Logistics',
            walletAddress: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
        },
        {
            email: 'pharmacy@pharma.com',
            password: defaultPassword,
            fullName: 'CVS Central Pharmacy',
            role: UserRole.PHARMACY,
            organization: 'CVS Health Care',
            walletAddress: '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
        },
        {
            email: 'regulator@pharma.com',
            password: defaultPassword,
            fullName: 'FDA Inspection Officer',
            role: UserRole.REGULATOR,
            organization: 'Food and Drug Administration',
            walletAddress: '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65',
        },
        {
            email: 'customer@pharma.com',
            password: defaultPassword,
            fullName: 'Mir Eashan Zaman',
            role: UserRole.CUSTOMER,
            organization: 'Public Consumer / Patient',
            walletAddress: '0xcd3b766cc5027d11055150d60447de35e1008473',
        },
    ];

    for (const u of usersToSeed) {
        const exists = await userRepo.findOne({ where: { email: u.email } });
        if (!exists) {
            await userRepo.save(userRepo.create(u));
            console.log(`Created User [${u.role}]: ${u.email}`);
        } else if (exists.fullName !== u.fullName) {
            exists.fullName = u.fullName;
            await userRepo.save(exists);
            console.log(`Updated User [${u.role}]: ${u.email} to ${u.fullName}`);
        }
    }

    const testDrugs = [
        {
            serialNumber: 'DRUG-001',
            drugName: 'Insulin Glargine 100 U/ml',
            manufacturer: 'PharmaCare Ltd.',
            batchNumber: 'BATCH-2026-001',
            dosageForm: 'Injectable Solution',
            strength: '100 U/mL',
            expiryDate: '2026-11-30',
            qcStatus: 'QC_PASSED',
            qcPurityPercentage: 98.4,
            qcPhLevel: 7.1,
            carrierName: 'Apex Medical Haulers',
            isRecalled: true,
            currentCustodian: 'Food and Drug Administration (Regulatory Quarantine)',
            custodyLocation: 'FDA National Enforcement Warehouse, Rockville, MD',
        },
        {
            serialNumber: 'DRUG-002',
            drugName: 'Pfizer COVID-19 Vaccine BNT162b2',
            manufacturer: 'Pfizer-BioNTech',
            batchNumber: 'BATCH-2026-002',
            dosageForm: 'Intramuscular Suspension',
            strength: '30 mcg/0.3 mL',
            expiryDate: '2027-09-30',
            qcStatus: 'IN_PRODUCTION',
            currentCustodian: 'Pfizer-BioNTech',
            custodyLocation: 'Kalamazoo Packaging Facility, Line 4',
        },
        {
            serialNumber: 'SN-2026-AMOX500',
            drugName: 'Amoxicillin 500mg Capsule',
            manufacturer: 'Novartis Global',
            batchNumber: 'BATCH-2026-A1',
            dosageForm: 'Oral Capsule',
            strength: '500 mg',
            expiryDate: '2028-12-31',
            apiSupplier: 'Lonza Fine Chemicals',
            apiCasNumber: '61336-70-7',
            rawMaterialLot: 'RM-LOT-8821',
            qcStatus: 'QC_PASSED',
            qcPurityPercentage: 99.85,
            qcPhLevel: 7.2,
            qcEndotoxinLimit: '< 0.1 EU/mL',
            qcCertHash: '0x8f7a932b1049c8192aef48123019ab76',
            qcSignedBy: 'Dr. Elena Rostova, Lead QC Chemist',
            carrierName: 'DHL Healthcare Logistics',
            sealNumber: 'SEAL-NOV-9942',
            inboundInspectionStatus: 'VERIFIED',
            inboundInspectionTemp: 4.2,
            inboundInspectionNotes: 'Dock seals intact, telemetry within 2-8 C',
            inboundInspectedBy: 'DHL Hub Supervisor J. Miller',
            assignedVehicleId: 'VAN-408',
            storageZone: 'ZONE_A_COLD_2_8',
            targetPharmacy: 'CVS Central Pharmacy',
            outboundManifestId: 'MAN-2026-8841',
            deliveryProofSignature: '0x3a4b9c1d8e7f',
            deliveryProofReceivedBy: 'Dr. Sarah Lin, PharmD',
            pharmacyInboundStatus: 'RECEIVED',
            pharmacyInboundTemp: 4.4,
            pharmacyInboundNotes: '3Ts continuous pedigree validated against e-BoL',
            pharmacyInboundPharmacist: 'Dr. Sarah Lin, PharmD',
            pharmacyInboundLicense: 'RPH-NY-448190',
            pharmacyStorageLocation: 'FRIDGE_VACCINE_1',
            prescriptionNumber: 'RX-2026-984421',
            prescribingDoctor: 'Dr. Robert Chen, MD',
            patientToken: 'PT-HASH-8831',
            dispensedByPharmacist: 'Dr. Sarah Lin, PharmD',
            dispenseNotes: 'Dispensed with GxP cold-pack container',
            isRecalled: false,
            currentCustodian: 'CVS Health Care',
            custodyLocation: '450 Medical Center Blvd, Suite 101, New York, NY',
        },
        {
            serialNumber: 'SN-2026-INSULIN',
            drugName: 'Recombinant Insulin 100IU/ml',
            manufacturer: 'Novo Nordisk',
            batchNumber: 'BATCH-2026-INS9',
            dosageForm: 'Subcutaneous Solution',
            strength: '100 IU/mL',
            expiryDate: '2027-06-30',
            apiSupplier: 'Novo Nordisk BioPharma',
            apiCasNumber: '11061-68-0',
            rawMaterialLot: 'LOT-INS-4491',
            qcStatus: 'QC_PASSED',
            qcPurityPercentage: 99.92,
            qcPhLevel: 7.35,
            qcEndotoxinLimit: '< 0.05 EU/mL',
            qcCertHash: '0x49a1b2c3d4e5f67890123456789abcdef',
            qcSignedBy: 'Dr. Henrik Lindqvist',
            carrierName: 'DHL Healthcare Logistics',
            sealNumber: 'SEAL-DHL-3301',
            assignedVehicleId: 'VAN-408',
            storageZone: 'REEFER_TRANSIT',
            inboundInspectionStatus: 'PENDING_INBOUND',
            inboundInspectionTemp: 4.1,
            isRecalled: false,
            currentCustodian: 'DHL Healthcare Logistics',
            custodyLocation: 'Interstate I-95 Northbound - Reefer Unit #408',
        },
    ];

    for (const d of testDrugs) {
        let drug = await drugRepo.findOne({ where: { serialNumber: d.serialNumber } });
        if (!drug) {
            drug = await drugRepo.save(drugRepo.create(d));
            console.log(`Created Drug Batch: ${drug.serialNumber}`);
        } else {
            Object.assign(drug, d);
            drug = await drugRepo.save(drug);
            console.log(`Updated Drug Batch: ${drug.serialNumber}`);
        }

        const eventCount = await eventRepo.count({ where: { drugSerialNumber: drug.serialNumber } });
        if (eventCount === 0) {
            const eventsToInsert: Array<{ eventType: EventType; eventData: Record<string, any> }> = [];

            if (drug.serialNumber === 'SN-2026-AMOX500') {
                eventsToInsert.push(
                    {
                        eventType: EventType.MANUFACTURED,
                        eventData: {
                            temperature: 20.5,
                            humidity: 42,
                            location: 'Novartis Basel Facility A',
                            signerAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
                        },
                    },
                    {
                        eventType: EventType.QUALITY_CHECKED,
                        eventData: {
                            purity: 99.85,
                            ph: 7.2,
                            disposition: 'QC_PASSED',
                            analyst: 'Dr. Elena Rostova',
                        },
                    },
                    {
                        eventType: EventType.SHIPPED,
                        eventData: {
                            carrier: 'DHL Healthcare Logistics',
                            seal: 'SEAL-NOV-9942',
                            vehicle: 'VAN-408',
                            temperature: 4.2,
                        },
                    },
                    {
                        eventType: EventType.RECEIVED,
                        eventData: {
                            location: 'DHL Regional Logistics Hub',
                            dockTemp: 4.2,
                            verifiedBy: 'J. Miller',
                        },
                    },
                    {
                        eventType: EventType.DISTRIBUTED,
                        eventData: {
                            destination: 'CVS Central Pharmacy',
                            manifestId: 'MAN-2026-8841',
                            podSigner: 'Dr. Sarah Lin, PharmD',
                        },
                    },
                    {
                        eventType: EventType.SOLD,
                        eventData: {
                            dispensedAt: 'CVS Central Pharmacy',
                            prescriptionNumber: 'RX-2026-984421',
                            doctor: 'Dr. Robert Chen, MD',
                        },
                    }
                );
            } else if (drug.serialNumber === 'SN-2026-INSULIN') {
                eventsToInsert.push(
                    {
                        eventType: EventType.MANUFACTURED,
                        eventData: {
                            temperature: 4.0,
                            humidity: 45,
                            location: 'Novo Nordisk Bagsvaerd Plant',
                            signerAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
                        },
                    },
                    {
                        eventType: EventType.QUALITY_CHECKED,
                        eventData: {
                            purity: 99.92,
                            ph: 7.35,
                            disposition: 'QC_PASSED',
                            analyst: 'Dr. Henrik Lindqvist',
                        },
                    },
                    {
                        eventType: EventType.SHIPPED,
                        eventData: {
                            carrier: 'DHL Healthcare Logistics',
                            seal: 'SEAL-DHL-3301',
                            vehicle: 'VAN-408',
                            temperature: 4.1,
                        },
                    },
                    {
                        eventType: EventType.TEMPERATURE_MONITORED,
                        eventData: {
                            temperature: 4.3,
                            humidity: 48,
                            telemetryNode: 'REEFER-IOT-VAN-408',
                            gpsCoordinates: '40.7128,-74.0060',
                        },
                    }
                );
            } else if (drug.serialNumber === 'DRUG-001') {
                eventsToInsert.push(
                    {
                        eventType: EventType.MANUFACTURED,
                        eventData: {
                            temperature: 4.5,
                            location: 'PharmaCare Plant #1',
                            signerAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
                        },
                    },
                    {
                        eventType: EventType.TEMPERATURE_MONITORED,
                        eventData: {
                            temperature: 14.8,
                            humidity: 78,
                            breachAlert: 'Excursion detected above 8.0 C threshold',
                        },
                    },
                    {
                        eventType: EventType.QUARANTINED,
                        eventData: {
                            reason: 'Temperature excursion during ambient dock hold',
                            officer: 'FDA Regional Field Inspector',
                        },
                    },
                    {
                        eventType: EventType.RECALLED,
                        eventData: {
                            class: 'CLASS_II',
                            scope: 'NATIONWIDE',
                            docket: 'FDA-ENF-2026-0881',
                        },
                    }
                );
            } else {
                eventsToInsert.push({
                    eventType: EventType.MANUFACTURED,
                    eventData: {
                        temperature: -70.0,
                        humidity: 30,
                        location: 'Kalamazoo Packaging Facility, Line 4',
                        signerAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
                    },
                });
            }

            for (const item of eventsToInsert) {
                const payload = {
                    drugSerialNumber: drug.serialNumber,
                    eventType: item.eventType,
                    eventData: item.eventData,
                };
                const eventHash = createHash('sha256')
                    .update(JSON.stringify(payload))
                    .digest('hex');

                await eventRepo.save(
                    eventRepo.create({
                        ...payload,
                        drug,
                        eventHash,
                    })
                );
                console.log(`Recorded Event [${item.eventType}] for ${drug.serialNumber}`);
            }
        }
    }

    console.log('Database Seeding Completed Successfully.');
    await dataSource.destroy();
}

seed().catch((err) => {
    console.error('Seeding Failed:', err);
    process.exit(1);
});
