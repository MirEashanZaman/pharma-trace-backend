import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { BlockchainFacade } from './blockchain.facade';
import { RpcLoadBalancer } from './load-balancer/rpc-load-balancer';
import { BatchAttestationEngine } from './merkle/batch-attestation.engine';
import { Eip712CustodyService } from './eip712/eip712-custody';
import { EpcisAggregator } from './epcis/epcis-aggregator';
import { IpfsService } from './ipfs/ipfs.service';
import { ZkProofEngine } from './zk/zk-proof.engine';
import { PaymasterService } from './account-abstraction/paymaster.service';
import { SoulboundAccreditationService } from './sbt/soulbound-accreditation.service';
import { DigitalTwinService } from './digital-twin/digital-twin.service';
import { PharmaEscrowService } from './escrow/pharma-escrow.service';
import { DidResolverService } from './did/did-resolver.service';
import { DigitalLinkService } from './digital-link/digital-link.service';
import { DigitalLinkController } from './digital-link/digital-link.controller';
import { EpcisJsonLdService } from './epcis/epcis-jsonld.service';
import { GovernanceTimelockService } from './governance/governance-timelock.service';
import { GovernanceController } from './governance/governance.controller';
import { KmsSignerService } from './kms/kms-signer.service';
import { KmsController } from './kms/kms.controller';
import { SensorConsensusEngine } from '../iot/consensus/sensor-consensus.engine';
import { StatusList2021Registry } from './vc/status-list-2021.registry';
import { VerifiableCredentialService } from './vc/verifiable-credential.service';
import { VcController } from './vc/vc.controller';
import { EpcisQueryService } from './epcis/epcis-query.service';
import { EpcisQueryController } from './epcis/epcis-query.controller';

@Module({
    controllers: [
        BlockchainController,
        DigitalLinkController,
        GovernanceController,
        KmsController,
        VcController,
        EpcisQueryController,
    ],
    providers: [
        BlockchainService,
        BlockchainFacade,
        RpcLoadBalancer,
        BatchAttestationEngine,
        Eip712CustodyService,
        EpcisAggregator,
        IpfsService,
        ZkProofEngine,
        PaymasterService,
        SoulboundAccreditationService,
        DigitalTwinService,
        PharmaEscrowService,
        DidResolverService,
        DigitalLinkService,
        EpcisJsonLdService,
        GovernanceTimelockService,
        KmsSignerService,
        SensorConsensusEngine,
        StatusList2021Registry,
        VerifiableCredentialService,
        EpcisQueryService,
    ],
    exports: [
        BlockchainService,
        BlockchainFacade,
        RpcLoadBalancer,
        BatchAttestationEngine,
        Eip712CustodyService,
        EpcisAggregator,
        IpfsService,
        ZkProofEngine,
        PaymasterService,
        SoulboundAccreditationService,
        DigitalTwinService,
        PharmaEscrowService,
        DidResolverService,
        DigitalLinkService,
        EpcisJsonLdService,
        GovernanceTimelockService,
        KmsSignerService,
        SensorConsensusEngine,
        StatusList2021Registry,
        VerifiableCredentialService,
        EpcisQueryService,
    ],
})
export class BlockchainModule {}
