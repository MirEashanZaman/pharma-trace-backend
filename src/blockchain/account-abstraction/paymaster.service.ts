import { Injectable, Logger } from '@nestjs/common';
import { keccak256, toUtf8Bytes, verifyMessage, Wallet, HDNodeWallet } from 'ethers';

export interface UserOperation {
    sender: string;
    nonce: number;
    initCode: string;
    callData: string;
    callGasLimit: number;
    verificationGasLimit: number;
    preVerificationGas: number;
    maxFeePerGas: number;
    maxPriorityFeePerGas: number;
    paymasterAndData: string;
    signature: string;
}

export interface PaymasterSponsorshipResult {
    isSponsored: boolean;
    paymasterAddress: string;
    paymasterAndData: string;
    validUntil: number;
    validAfter: number;
    gasLimitCovered: number;
    sponsorPolicyId: string;
}

export interface UserOpValidationResult {
    isValid: boolean;
    reason?: string;
    sender: string;
    gasSponsored: boolean;
    userOpHash: string;
}

@Injectable()
export class PaymasterService {
    private readonly logger = new Logger(PaymasterService.name);
    private readonly paymasterSigner: HDNodeWallet;
    private readonly approvedActions: Set<string> = new Set([
        'packBatch',
        'shipTransit',
        'receiveCustody',
        'dispenseMedicine',
        'recordTelemetry',
    ]);

    constructor() {
        this.paymasterSigner = Wallet.createRandom();
        this.logger.log(`Initialized ERC-4337 Enterprise Paymaster at ${this.paymasterSigner.address}`);
    }

    getPaymasterAddress(): string {
        return this.paymasterSigner.address;
    }

    computeUserOpHash(userOp: Omit<UserOperation, 'signature'>): string {
        const packed = `${userOp.sender}:${userOp.nonce}:${userOp.callData}:${userOp.paymasterAndData}`;
        return keccak256(toUtf8Bytes(packed));
    }

    async sponsorUserOperation(
        userOp: Omit<UserOperation, 'paymasterAndData' | 'signature'>,
        actionName: string,
    ): Promise<PaymasterSponsorshipResult> {
        if (!this.approvedActions.has(actionName)) {
            throw new Error(`Action '${actionName}' is not authorized for corporate gas sponsorship`);
        }

        const validAfter = Math.max(0, Math.floor(Date.now() / 1000) - 60);
        const validUntil = validAfter + 3600;
        const totalGas = userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas;

        const sponsorshipPayload = `${this.paymasterSigner.address.toLowerCase()}:${validUntil}:${validAfter}:${userOp.sender.toLowerCase()}`;
        const paymasterSignature = await this.paymasterSigner.signMessage(sponsorshipPayload);
        const paymasterAndData = `${this.paymasterSigner.address.toLowerCase()}:${validUntil}:${validAfter}:${paymasterSignature}`;

        return {
            isSponsored: true,
            paymasterAddress: this.paymasterSigner.address,
            paymasterAndData,
            validUntil,
            validAfter,
            gasLimitCovered: totalGas,
            sponsorPolicyId: `POLICY-PHARMA-ENTERPRISE-01`,
        };
    }

    validateSponsoredOperation(userOp: UserOperation): UserOpValidationResult {
        const parts = userOp.paymasterAndData.split(':');
        if (parts.length < 4) {
            return {
                isValid: false,
                reason: 'Malformed paymasterAndData envelope',
                sender: userOp.sender,
                gasSponsored: false,
                userOpHash: '',
            };
        }

        const [paymasterAddress, validUntilStr, validAfterStr, signature] = parts;
        const validUntil = parseInt(validUntilStr, 10);
        const validAfter = parseInt(validAfterStr, 10);
        const nowSec = Math.floor(Date.now() / 1000);

        if (nowSec > validUntil || nowSec < validAfter) {
            return {
                isValid: false,
                reason: 'Sponsorship envelope timestamp expired or not yet active',
                sender: userOp.sender,
                gasSponsored: false,
                userOpHash: '',
            };
        }

        const sponsorshipPayload = `${paymasterAddress.toLowerCase()}:${validUntil}:${validAfter}:${userOp.sender.toLowerCase()}`;
        try {
            const recovered = verifyMessage(sponsorshipPayload, signature);
            if (recovered.toLowerCase() !== this.paymasterSigner.address.toLowerCase()) {
                return {
                    isValid: false,
                    reason: 'Paymaster signature mismatch',
                    sender: userOp.sender,
                    gasSponsored: false,
                    userOpHash: '',
                };
            }
        } catch (err: any) {
            return {
                isValid: false,
                reason: `Failed to verify paymaster signature: ${err.message}`,
                sender: userOp.sender,
                gasSponsored: false,
                userOpHash: '',
            };
        }

        const userOpHash = this.computeUserOpHash(userOp);
        return {
            isValid: true,
            sender: userOp.sender,
            gasSponsored: true,
            userOpHash,
        };
    }
}
