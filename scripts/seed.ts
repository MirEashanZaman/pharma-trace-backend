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
            drugName: 'Insulin Injection',
            manufacturer: 'PharmaCare Ltd.',
            batchNumber: 'BATCH-2026-001',
        },
        {
            serialNumber: 'DRUG-002',
            drugName: 'Pfizer COVID-19 Vaccine',
            manufacturer: 'Pfizer-BioNTech',
            batchNumber: 'BATCH-2026-002',
        },
        {
            serialNumber: 'SN-2026-AMOX500',
            drugName: 'Amoxicillin 500mg Capsule',
            manufacturer: 'Novartis Global',
            batchNumber: 'BATCH-2026-A1',
        },
        {
            serialNumber: 'SN-2026-INSULIN',
            drugName: 'Recombinant Insulin 100IU/ml',
            manufacturer: 'Novo Nordisk',
            batchNumber: 'BATCH-2026-INS9',
        },
    ];

    for (const d of testDrugs) {
        let drug = await drugRepo.findOne({ where: { serialNumber: d.serialNumber } });
        if (!drug) {
            drug = await drugRepo.save(drugRepo.create(d));
            console.log(`Created Drug Batch: ${drug.serialNumber}`);
        }

        const eventCount = await eventRepo.count({ where: { drugSerialNumber: drug.serialNumber } });
        if (eventCount === 0) {
            const payload = {
                drugSerialNumber: drug.serialNumber,
                eventType: EventType.MANUFACTURED,
                eventData: {
                    temperature: 4.5,
                    humidity: 45,
                    location: 'Basel Manufacturing Plant #1',
                    signerAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
                },
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
            console.log(`Recorded Genesis Event [MANUFACTURED] for ${drug.serialNumber}`);
        }
    }

    console.log('Database Seeding Completed Successfully.');
    await dataSource.destroy();
}

seed().catch((err) => {
    console.error('Seeding Failed:', err);
    process.exit(1);
});
