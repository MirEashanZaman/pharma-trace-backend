import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { BlockchainFacade } from './blockchain.facade';

@Module({
    controllers: [BlockchainController],
    providers: [BlockchainService, BlockchainFacade],
    exports: [BlockchainService, BlockchainFacade],
})
export class BlockchainModule {}
