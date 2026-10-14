import { Injectable } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';

export interface AnchorResult {
    success: boolean;
    txHash: string;
    blockNumber: number;
    anchoredHash: string;
    serialNumber: string;
    timestamp: number;
}

export interface OnChainVerification {
    exists: boolean;
    isValid: boolean;
    drugSerialNumber: string;
    eventType: string;
    signer: string;
    timestamp: number;
    metadataUri: string;
    onChain: boolean;
}

export interface IBlockchainFacade {
    anchorEventProof(serialNumber: string, eventType: string, eventHash: string): Promise<AnchorResult>;
    verifyAttestation(hash: string): Promise<OnChainVerification>;
    getContractAddress(): string;
}

@Injectable()
export class BlockchainFacade implements IBlockchainFacade {
    constructor(private readonly blockchainService: BlockchainService) {}

    async anchorEventProof(
        serialNumber: string,
        eventType: string,
        eventHash: string,
    ): Promise<AnchorResult> {
        const receipt = await this.blockchainService.anchorAttestation(
            eventHash,
            serialNumber,
            eventType,
            `ipfs://${eventHash}`,
        );

        return {
            success: receipt.status === 1,
            txHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            anchoredHash: eventHash,
            serialNumber,
            timestamp: Date.now(),
        };
    }

    async verifyAttestation(hash: string): Promise<OnChainVerification> {
        const record = await this.blockchainService.getAttestation(hash);
        return {
            exists: record.exists,
            isValid: record.exists,
            drugSerialNumber: record.drugSerialNumber,
            eventType: record.eventType,
            signer: record.signer,
            timestamp: Number(record.timestamp),
            metadataUri: record.metadataUri,
            onChain: true,
        };
    }

    getContractAddress(): string {
        return this.blockchainService.getContractAddress();
    }
}
