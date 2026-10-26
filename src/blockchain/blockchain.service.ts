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

    private digitalTwinContract: ethers.Contract | null = null;
    private escrowContract: ethers.Contract | null = null;
    private carrierStakingContract: ethers.Contract | null = null;
    private governanceTimelockContract: ethers.Contract | null = null;
    private paymasterContract: ethers.Contract | null = null;
    private zkVerifierContract: ethers.Contract | null = null;

    private readonly localAttestations: Map<string, AttestationAnchor> = new Map();
    private readonly drugHistoryIndex: Map<string, string[]> = new Map();

    async onModuleInit() {
        await this.initializeBlockchain();
    }

    private loadContract(
        contractName: string,
        address: string,
        abiFileName: string,
    ): ethers.Contract | null {
        if (!address || !this.wallet) {
            return null;
        }
        try {
            const artifactPath = path.resolve(__dirname, 'artifacts', `${abiFileName}.json`);
            if (fs.existsSync(artifactPath)) {
                const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
                const contract = new ethers.Contract(address, artifact.abi, this.wallet);
                this.logger.log(`Connected to ${contractName} at ${address}`);
                return contract;
            }
        } catch (error: any) {
            this.logger.warn(`Failed to initialize ${contractName}: ${error.message}`);
        }
        return null;
    }

    private async initializeBlockchain() {
        const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
        const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

        try {
            this.provider = new ethers.JsonRpcProvider(rpcUrl);

            if (privateKey) {
                this.wallet = new ethers.Wallet(privateKey, this.provider);
            }

            let deployedRegistry: Record<string, string> = {};
            const registryPath = path.resolve(__dirname, 'artifacts', 'deployed-addresses.json');
            if (fs.existsSync(registryPath)) {
                try {
                    const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
                    deployedRegistry = parsed.contracts || {};
                } catch {}
            }

            const attestationAddr = process.env.BLOCKCHAIN_CONTRACT_ADDRESS || deployedRegistry['PharmaTraceAttestation'] || this.contractAddress;
            const timelockAddr = process.env.TIMELOCK_CONTRACT_ADDRESS || deployedRegistry['PharmaGovernanceTimelock'] || '';
            const stakingAddr = process.env.CARRIER_STAKING_CONTRACT_ADDRESS || deployedRegistry['CarrierStakingEscrow'] || '';
            const digitalTwinAddr = process.env.DIGITAL_TWIN_CONTRACT_ADDRESS || deployedRegistry['PharmaDigitalTwin'] || '';
            const escrowAddr = process.env.ESCROW_ENGINE_CONTRACT_ADDRESS || deployedRegistry['PharmaEscrowEngine'] || '';
            const paymasterAddr = process.env.PAYMASTER_CONTRACT_ADDRESS || deployedRegistry['PharmaPaymaster'] || '';
            const zkVerifierAddr = process.env.ZK_VERIFIER_CONTRACT_ADDRESS || deployedRegistry['ZkColdChainVerifier'] || '';

            this.contract = this.loadContract('PharmaTraceAttestation', attestationAddr, 'PharmaTraceAttestation');
            this.digitalTwinContract = this.loadContract('PharmaDigitalTwin', digitalTwinAddr, 'PharmaDigitalTwin');
            this.escrowContract = this.loadContract('PharmaEscrowEngine', escrowAddr, 'PharmaEscrowEngine');
            this.carrierStakingContract = this.loadContract('CarrierStakingEscrow', stakingAddr, 'CarrierStakingEscrow');
            this.governanceTimelockContract = this.loadContract('PharmaGovernanceTimelock', timelockAddr, 'PharmaGovernanceTimelock');
            this.paymasterContract = this.loadContract('PharmaPaymaster', paymasterAddr, 'PharmaPaymaster');
            this.zkVerifierContract = this.loadContract('ZkColdChainVerifier', zkVerifierAddr, 'ZkColdChainVerifier');

            if (!this.contract) {
                this.logger.warn(
                    'Blockchain contract address or private key not specified. Operating in hybrid / self-anchoring mode.'
                );
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

    getDigitalTwinContract(): ethers.Contract | null {
        return this.digitalTwinContract;
    }

    getEscrowContract(): ethers.Contract | null {
        return this.escrowContract;
    }

    getCarrierStakingContract(): ethers.Contract | null {
        return this.carrierStakingContract;
    }

    getGovernanceTimelockContract(): ethers.Contract | null {
        return this.governanceTimelockContract;
    }

    getPaymasterContract(): ethers.Contract | null {
        return this.paymasterContract;
    }

    getZkVerifierContract(): ethers.Contract | null {
        return this.zkVerifierContract;
    }

    async verifyZkProofOnChain(
        a: [string, string],
        b: [[string, string], [string, string]],
        c: [string, string],
        batchHash: string,
        minTemp: number,
        maxTemp: number,
    ): Promise<boolean> {
        if (this.zkVerifierContract) {
            try {
                const bytes32Batch = this.formatBytes32(batchHash);
                return await this.zkVerifierContract.verifyColdChainIntegrity(a, b, c, bytes32Batch, minTemp, maxTemp);
            } catch (err: any) {
                this.logger.warn(`On-chain ZK cold-chain verification call failed: ${err.message}`);
            }
        }
        return false;
    }

    getAttestationContract(): ethers.Contract | null {
        return this.contract;
    }

    getProvider(): ethers.JsonRpcProvider | null {
        return this.provider;
    }

    getWallet(): ethers.Wallet | null {
        return this.wallet;
    }
}
