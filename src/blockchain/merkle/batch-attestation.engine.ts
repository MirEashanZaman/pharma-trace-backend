import { Injectable, Logger } from '@nestjs/common';
import { keccak256, toUtf8Bytes } from 'ethers';
import { MerkleTree } from './merkle-tree';

export interface BatchItem {
    serialNumber: string;
    eventType: string;
    dataHash: string;
    metadataUri?: string;
    timestamp: number;
}

export interface AnchoredBatch {
    batchId: string;
    merkleRoot: string;
    batchSize: number;
    ipfsCid: string;
    anchoredAt: number;
    transactionHash?: string;
    items: BatchItem[];
}

export interface BatchInclusionResult {
    isValid: boolean;
    batchId: string;
    merkleRoot: string;
    leaf: string;
    proof: string[];
    ipfsCid: string;
    anchoredAt: number;
}

@Injectable()
export class BatchAttestationEngine {
    private readonly logger = new Logger(BatchAttestationEngine.name);
    private readonly batches: Map<string, AnchoredBatch> = new Map();
    private readonly itemToBatchIndex: Map<string, string> = new Map();
    private readonly trees: Map<string, MerkleTree> = new Map();

    computeLeaf(item: BatchItem): string {
        const payload = `${item.serialNumber}:${item.eventType}:${item.dataHash}:${item.timestamp}`;
        return keccak256(toUtf8Bytes(payload));
    }

    createBatch(items: BatchItem[]): AnchoredBatch {
        if (!items || items.length === 0) {
            throw new Error('Batch requires at least one item');
        }

        const leaves = items.map((item) => this.computeLeaf(item));
        const tree = new MerkleTree(leaves);
        const merkleRoot = tree.getRoot();
        const batchId = `BATCH-${Date.now()}-${merkleRoot.slice(2, 10)}`;
        const ipfsCid = `ipfs://bafybeic${merkleRoot.slice(2, 26).toLowerCase()}`;

        const batch: AnchoredBatch = {
            batchId,
            merkleRoot,
            batchSize: items.length,
            ipfsCid,
            anchoredAt: Date.now(),
            items: [...items],
        };

        this.batches.set(batchId, batch);
        this.trees.set(batchId, tree);

        for (const item of items) {
            this.itemToBatchIndex.set(item.serialNumber, batchId);
        }

        this.logger.log(`Created batch ${batchId} with ${items.length} items. Root: ${merkleRoot}`);
        return batch;
    }

    getProofForItem(batchId: string, item: BatchItem): string[] {
        const tree = this.trees.get(batchId);
        if (!tree) {
            throw new Error(`Batch ${batchId} not found`);
        }
        const leaf = this.computeLeaf(item);
        return tree.getProof(leaf);
    }

    verifyItemInclusion(serialNumber: string, item: BatchItem): BatchInclusionResult {
        const batchId = this.itemToBatchIndex.get(serialNumber);
        if (!batchId) {
            return {
                isValid: false,
                batchId: '',
                merkleRoot: '',
                leaf: '',
                proof: [],
                ipfsCid: '',
                anchoredAt: 0,
            };
        }

        const batch = this.batches.get(batchId)!;
        const tree = this.trees.get(batchId)!;
        const leaf = this.computeLeaf(item);
        const proof = tree.getProof(leaf);
        const isValid = MerkleTree.verifyProof(leaf, proof, batch.merkleRoot);

        return {
            isValid,
            batchId,
            merkleRoot: batch.merkleRoot,
            leaf,
            proof,
            ipfsCid: batch.ipfsCid,
            anchoredAt: batch.anchoredAt,
        };
    }

    getBatch(batchId: string): AnchoredBatch | undefined {
        return this.batches.get(batchId);
    }

    getAllBatches(): AnchoredBatch[] {
        return Array.from(this.batches.values());
    }
}
