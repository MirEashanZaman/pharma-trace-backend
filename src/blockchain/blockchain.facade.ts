import { Injectable } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { AttestationAnchor, VerifyAttestationResult } from './blockchain.types';

export interface AnchorResult {
    success: boolean;
    txHash?: string;
    blockNumber?: number;
    anchoredHash: string;
    serialNumber: string;
    timestamp: number;
}

export interface IBlockchainFacade {
    anchorEventProof(serialNumber: string, eventType: string, eventHash: string): Promise<AnchorResult>;
    verifyAttestation(hash: string): Promise<VerifyAttestationResult>;
}

@Injectable()
export class BlockchainFacade implements IBlockchainFacade {
    constructor(private readonly blockchainService: BlockchainService) {}

    async anchorEventProof(
        serialNumber: string,
        eventType: string,
        eventHash: string,
    ): Promise<AnchorResult> {
        const anchor: AttestationAnchor = await this.blockchainService.anchorAttestation(
            eventHash,
            serialNumber,
            eventType,
            '0x0000000000000000000000000000000000000000',
            `ipfs://${eventHash}`,
        );

        return {
            success: !anchor.isRevoked,
            txHash: anchor.transactionHash,
            blockNumber: anchor.blockNumber,
            anchoredHash: eventHash,
            serialNumber,
            timestamp: anchor.timestamp,
        };
    }

    async verifyAttestation(hash: string): Promise<VerifyAttestationResult> {
        return this.blockchainService.verifyAttestation(hash);
    }
}
