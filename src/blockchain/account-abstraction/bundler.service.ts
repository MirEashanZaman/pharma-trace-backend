import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { keccak256, toUtf8Bytes, getAddress, isAddress } from 'ethers';
import { UserOperation, PaymasterService } from './paymaster.service';

export interface UserOpReceipt {
    userOpHash: string;
    sender: string;
    nonce: number;
    success: boolean;
    actualGasCost: number;
    actualGasUsed: number;
    transactionHash: string;
    blockNumber: number;
    timestamp: number;
}

export interface UserOpBundle {
    bundleId: string;
    operations: UserOperation[];
    totalGasLimit: number;
    beneficiary: string;
    status: 'QUEUED' | 'SIMULATED' | 'EXECUTED' | 'FAILED';
    createdAt: number;
}

export interface MempoolStatus {
    pendingCount: number;
    pendingUserOpHashes: string[];
}

@Injectable()
export class BundlerService {
    private readonly logger = new Logger(BundlerService.name);
    private readonly mempool: Map<string, UserOperation> = new Map();
    private readonly receipts: Map<string, UserOpReceipt> = new Map();
    private readonly defaultBeneficiary: string = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

    constructor(private readonly paymasterService: PaymasterService) {}

    estimateUserOpGas(userOp: Partial<UserOperation>): {
        callGasLimit: number;
        verificationGasLimit: number;
        preVerificationGas: number;
    } {
        const callDataLength = userOp.callData ? userOp.callData.length : 2;
        const callGasLimit = 50000 + callDataLength * 120;
        const verificationGasLimit = 150000;
        const preVerificationGas = 45000;

        return {
            callGasLimit,
            verificationGasLimit,
            preVerificationGas,
        };
    }

    sendUserOperation(userOp: UserOperation): { userOpHash: string; queued: boolean } {
        if (!userOp.sender || !isAddress(userOp.sender)) {
            throw new BadRequestException('Invalid or missing UserOperation sender address');
        }

        const validation = this.paymasterService.validateSponsoredOperation(userOp);
        if (!validation.isValid) {
            throw new BadRequestException(`UserOperation sponsorship validation failed: ${validation.reason}`);
        }

        const userOpHash = this.paymasterService.computeUserOpHash(userOp);

        if (this.mempool.has(userOpHash)) {
            throw new BadRequestException('UserOperation with this hash already present in bundler mempool');
        }

        this.mempool.set(userOpHash, userOp);
        this.logger.log(`Accepted UserOperation ${userOpHash} from ${userOp.sender} into bundler mempool`);

        return {
            userOpHash,
            queued: true,
        };
    }

    createBundle(maxBatchSize: number = 10, beneficiary?: string): UserOpBundle {
        if (this.mempool.size === 0) {
            throw new BadRequestException('Bundler mempool is empty; no UserOperations to bundle');
        }

        const ops: UserOperation[] = [];
        let totalGas = 0;

        for (const [hash, op] of this.mempool.entries()) {
            if (ops.length >= maxBatchSize) {
                break;
            }
            ops.push(op);
            totalGas += (op.callGasLimit + op.verificationGasLimit + op.preVerificationGas);
            this.mempool.delete(hash);
        }

        const bundleId = keccak256(toUtf8Bytes(`BUNDLE:${Date.now()}:${ops.length}`));

        return {
            bundleId,
            operations: ops,
            totalGasLimit: totalGas,
            beneficiary: beneficiary && isAddress(beneficiary) ? getAddress(beneficiary) : this.defaultBeneficiary,
            status: 'QUEUED',
            createdAt: Math.floor(Date.now() / 1000),
        };
    }

    simulateBundle(bundle: UserOpBundle): { bundleId: string; simulatedOk: boolean; validOpsCount: number } {
        let validOpsCount = 0;
        for (const op of bundle.operations) {
            const check = this.paymasterService.validateSponsoredOperation(op);
            if (check.isValid) {
                validOpsCount++;
            }
        }

        const simulatedOk = validOpsCount === bundle.operations.length;
        bundle.status = simulatedOk ? 'SIMULATED' : 'FAILED';

        return {
            bundleId: bundle.bundleId,
            simulatedOk,
            validOpsCount,
        };
    }

    async executeBundle(bundle: UserOpBundle): Promise<{
        bundleId: string;
        transactionHash: string;
        executedCount: number;
        receipts: UserOpReceipt[];
    }> {
        if (bundle.status !== 'SIMULATED') {
            const sim = this.simulateBundle(bundle);
            if (!sim.simulatedOk) {
                throw new BadRequestException(`Cannot execute bundle ${bundle.bundleId}: simulation failed`);
            }
        }

        const txHash = keccak256(toUtf8Bytes(`TX_HANDLE_OPS:${bundle.bundleId}:${Date.now()}`));
        const blockNumber = Math.floor(Date.now() / 12000) + 1000000;
        const bundleReceipts: UserOpReceipt[] = [];

        for (const op of bundle.operations) {
            const userOpHash = this.paymasterService.computeUserOpHash(op);
            const actualGasUsed = Math.floor(op.callGasLimit * 0.7) + op.preVerificationGas;
            const actualGasCost = actualGasUsed * (op.maxFeePerGas || 2000000000);

            const receipt: UserOpReceipt = {
                userOpHash,
                sender: op.sender,
                nonce: op.nonce,
                success: true,
                actualGasCost,
                actualGasUsed,
                transactionHash: txHash,
                blockNumber,
                timestamp: Math.floor(Date.now() / 1000),
            };

            this.receipts.set(userOpHash, receipt);
            bundleReceipts.push(receipt);
        }

        bundle.status = 'EXECUTED';
        this.logger.log(`Bundler executed batch ${bundle.bundleId} with ${bundleReceipts.length} UserOperations in tx ${txHash}`);

        return {
            bundleId: bundle.bundleId,
            transactionHash: txHash,
            executedCount: bundleReceipts.length,
            receipts: bundleReceipts,
        };
    }

    getUserOpReceipt(userOpHash: string): UserOpReceipt {
        const receipt = this.receipts.get(userOpHash);
        if (!receipt) {
            throw new NotFoundException(`UserOperation receipt for ${userOpHash} not found`);
        }
        return receipt;
    }

    getMempoolStatus(): MempoolStatus {
        return {
            pendingCount: this.mempool.size,
            pendingUserOpHashes: Array.from(this.mempool.keys()),
        };
    }
}
