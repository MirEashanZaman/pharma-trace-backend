import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import * as path from 'path';
import * as fs from 'fs';
import { AttestationAnchor, VerifyAttestationResult } from './blockchain.types';

@Injectable()
export class BlockchainService implements OnModuleInit {
    private readonly logger = new Logger(BlockchainService.name);
    private provider: ethers.JsonRpcProvider | null = null;
    private wallet: ethers.Wallet | null = null;
    private contract: ethers.Contract | null = null;
    private contractAddress: string = process.env.BLOCKCHAIN_CONTRACT_ADDRESS || '';

    
    private readonly localAttestations: Map<string, AttestationAnchor> = new Map();
    private readonly drugHistoryIndex: Map<string, string[]> = new Map();

    async onModuleInit() {
        await this.initializeBlockchain();
    }

    private async initializeBlockchain() {
        const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
        const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

        try {
            this.provider = new ethers.JsonRpcProvider(rpcUrl);

            if (privateKey) {
                this.wallet = new ethers.Wallet(privateKey, this.provider);
            }

            const artifactPath = path.resolve(__dirname, 'artifacts', 'PharmaTraceAttestation.json');
            if (fs.existsSync(artifactPath)) {
                const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

                if (this.contractAddress && this.wallet) {
                    this.contract = new ethers.Contract(this.contractAddress, artifact.abi, this.wallet);
                    this.logger.log(` Connected to Blockchain Attestation Contract at ${this.contractAddress}`);
                } else {
                    this.logger.warn(
                        ' Blockchain contract address or private key not specified. Operating in hybrid / self-anchoring mode.'
                    );
                }
            }
        } catch (error: any) {
            this.logger.warn(`Blockchain provider connection skipped: ${error.message}`);
        }
    }

    
    private formatBytes32(hash: string): string {
        if (hash.startsWith('0x') && hash.length === 66) {
            return hash;
        }
        const clean = hash.replace(/^0x/, '');
        return '0x' + clean.padEnd(64, '0').slice(0, 64);
    }

    
    async anchorAttestation(
        dataHash: string,
        drugSerialNumber: string,
        eventType: string,
        signerAddress: string = '0x0000000000000000000000000000000000000000',
        metadataUri: string = ''
    ): Promise<AttestationAnchor> {
        const bytes32Hash = this.formatBytes32(dataHash);
        let txHash: string | undefined;
        let blockNumber: number | undefined;

        
        if (this.contract) {
            try {
                const tx = await this.contract.registerAttestation(
                    bytes32Hash,
                    drugSerialNumber,
                    eventType,
                    metadataUri
                );
                const receipt = await tx.wait();
                txHash = receipt.hash;
                blockNumber = receipt.blockNumber;
                this.logger.log(` Anchored attestation on-chain: ${txHash}`);
            } catch (err: any) {
                this.logger.error(`Failed to register on-chain attestation: ${err.message}`);
            }
        }

        const anchor: AttestationAnchor = {
            dataHash: bytes32Hash,
            drugSerialNumber,
            eventType,
            signer: signerAddress,
            timestamp: Date.now(),
            transactionHash: txHash,
            blockNumber,
            isRevoked: false,
            metadataUri,
        };

        this.localAttestations.set(bytes32Hash, anchor);
        const history = this.drugHistoryIndex.get(drugSerialNumber) || [];
        history.push(bytes32Hash);
        this.drugHistoryIndex.set(drugSerialNumber, history);

        return anchor;
    }

    
    async verifyAttestation(dataHash: string): Promise<VerifyAttestationResult> {
        const bytes32Hash = this.formatBytes32(dataHash);

        if (this.contract) {
            try {
                const result = await this.contract.verifyAttestation(bytes32Hash);
                if (result.exists) {
                    return {
                        exists: true,
                        isValid: result.isValid,
                        drugSerialNumber: result.drugSerialNumber,
                        eventType: result.eventType,
                        signer: result.signer,
                        timestamp: Number(result.timestamp) * 1000,
                        metadataUri: result.metadataUri,
                        onChain: true,
                    };
                }
            } catch (err: any) {
                this.logger.warn(`On-chain verification query failed: ${err.message}`);
            }
        }

        const local = this.localAttestations.get(bytes32Hash);
        if (local) {
            const explorerBase = process.env.BLOCKCHAIN_EXPLORER_URL || 'https://sepolia.etherscan.io/tx/';
            return {
                exists: true,
                isValid: !local.isRevoked,
                drugSerialNumber: local.drugSerialNumber,
                eventType: local.eventType,
                signer: local.signer,
                timestamp: local.timestamp,
                metadataUri: local.metadataUri || '',
                onChain: !!local.transactionHash,
                transactionHash: local.transactionHash,
                explorerUrl: local.transactionHash ? `${explorerBase}${local.transactionHash}` : undefined,
            };
        }

        return {
            exists: false,
            isValid: false,
            drugSerialNumber: '',
            eventType: '',
            signer: ethers.ZeroAddress,
            timestamp: 0,
            metadataUri: '',
            onChain: false,
        };
    }

    
    getDrugAttestations(drugSerialNumber: string): AttestationAnchor[] {
        const hashes = this.drugHistoryIndex.get(drugSerialNumber) || [];
        return hashes.map((h) => this.localAttestations.get(h)!).filter(Boolean);
    }

    
    tamperAttestation(dataHash: string): boolean {
        const bytes32Hash = this.formatBytes32(dataHash);
        const record = this.localAttestations.get(bytes32Hash);
        if (!record) return false;
        record.isRevoked = true;
        return true;
    }

    
    verifyWalletSignature(message: string, signature: string, expectedAddress: string): boolean {
        try {
            const recoveredAddress = ethers.verifyMessage(message, signature);
            return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
        } catch {
            return false;
        }
    }

    async anchorBatchOnChain(
        merkleRoot: string,
        batchSize: number,
        ipfsCid: string,
    ): Promise<{ transactionHash?: string; blockNumber?: number; success: boolean }> {
        const bytes32Root = this.formatBytes32(merkleRoot);
        if (this.contract) {
            try {
                const tx = await this.contract.anchorBatch(bytes32Root, batchSize, ipfsCid);
                const receipt = await tx.wait();
                this.logger.log(`Anchored batch root on-chain: ${receipt.hash}`);
                return {
                    transactionHash: receipt.hash,
                    blockNumber: receipt.blockNumber,
                    success: true,
                };
            } catch (err: any) {
                this.logger.error(`Failed to anchor batch on-chain: ${err.message}`);
            }
        }
        return {
            success: true,
        };
    }

    async verifyBatchInclusionOnChain(
        leaf: string,
        proof: string[],
        merkleRoot: string,
    ): Promise<boolean> {
        const bytes32Leaf = this.formatBytes32(leaf);
        const bytes32Root = this.formatBytes32(merkleRoot);
        const bytes32Proof = proof.map((p) => this.formatBytes32(p));

        if (this.contract) {
            try {
                return await this.contract.verifyBatchInclusion(bytes32Leaf, bytes32Proof, bytes32Root);
            } catch (err: any) {
                this.logger.warn(`On-chain batch inclusion verification query failed: ${err.message}`);
            }
        }

        return false;
    }
}
