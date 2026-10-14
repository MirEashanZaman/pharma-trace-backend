import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { BlockchainFacade } from './blockchain.facade';
import { RpcLoadBalancer } from './load-balancer/rpc-load-balancer';

@Module({
    controllers: [BlockchainController],
    providers: [BlockchainService, BlockchainFacade, RpcLoadBalancer],
    exports: [BlockchainService, BlockchainFacade, RpcLoadBalancer],
})
export class BlockchainModule {}
