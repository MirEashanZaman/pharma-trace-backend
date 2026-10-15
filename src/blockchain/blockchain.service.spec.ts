import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { IpfsService } from './ipfs/ipfs.service';
import { ZkProofEngine } from './zk/zk-proof.engine';
import { PaymasterService } from './account-abstraction/paymaster.service';
import { SoulboundAccreditationService } from './sbt/soulbound-accreditation.service';
import { DigitalTwinService } from './digital-twin/digital-twin.service';
import { PharmaEscrowService } from './escrow/pharma-escrow.service';
import { DidResolverService } from './did/did-resolver.service';
import { EpcisJsonLdService } from './epcis/epcis-jsonld.service';
import { SensorConsensusEngine } from '../iot/consensus/sensor-consensus.engine';

describe('BlockchainModule Integration', () => {
    let service: BlockchainService;
    let controller: BlockchainController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [BlockchainController],
            providers: [
                BlockchainService,
                IpfsService,
                ZkProofEngine,
                PaymasterService,
                SoulboundAccreditationService,
                DigitalTwinService,
                PharmaEscrowService,
                DidResolverService,
                EpcisJsonLdService,
                SensorConsensusEngine,
            ],
        }).compile();

        service = module.get<BlockchainService>(BlockchainService);
        controller = module.get<BlockchainController>(BlockchainController);
        await service.onModuleInit();
    });

    it('should anchor an attestation and verify it successfully', async () => {
        const testHash = '0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';
        const serial = 'BATCH-2026-XYZ';
        const eventType = 'MANUFACTURED';

        const anchor = await service.anchorAttestation(testHash, serial, eventType);
        expect(anchor).toBeDefined();
        expect(anchor.drugSerialNumber).toBe(serial);

        const verification = await service.verifyAttestation(testHash);
        expect(verification.exists).toBe(true);
        expect(verification.isValid).toBe(true);
        expect(verification.drugSerialNumber).toBe(serial);
    });

    it('should detect tampered or revoked attestations', async () => {
        const testHash = '0x99887766554433221100ffeeddccbbaa99887766554433221100ffeeddccbbaa';
        const serial = 'BATCH-TAMPER-TEST';

        await service.anchorAttestation(testHash, serial, 'SHIPPED');
        const tampered = service.tamperAttestation(testHash);
        expect(tampered).toBe(true);

        const verification = await service.verifyAttestation(testHash);
        expect(verification.exists).toBe(true);
        expect(verification.isValid).toBe(false);
    });
});
