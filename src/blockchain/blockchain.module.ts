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

@Module({
    controllers: [BlockchainController],
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
    ],
})
export class BlockchainModule {}
