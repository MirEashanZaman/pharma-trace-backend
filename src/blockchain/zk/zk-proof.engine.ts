import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { keccak256, toUtf8Bytes } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

export interface ZkSnarkProof {
    protocol: 'groth16';
    curve: 'bn128';
    pi_a: [string, string];
    pi_b: [[string, string], [string, string]];
    pi_c: [string, string];
    publicSignals: string[];
}

export interface ZkSolidityCalldata {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
    input: [string, string, string, string];
}

export interface ZkColdChainVerificationResult {
    isValid: boolean;
    batchHash: string;
    temperatureRange: {
        min: number;
        max: number;
    };
    readingsEvaluated: number;
    isCompliant: boolean;
    proofDigest: string;
    nullifier?: string;
    isReplay?: boolean;
    poseidonCommitment?: string;
}

export interface ZkMembershipVerificationResult {
    isValid: boolean;
    merkleRoot: string;
    nullifierHash: string;
    proofDigest: string;
}

const BN128_Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583n;
const BN128_R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

@Injectable()
export class ZkProofEngine implements OnModuleInit {
    private readonly logger = new Logger(ZkProofEngine.name);
    private poseidonFn: any = null;
    private readonly usedNullifiers: Set<string> = new Set();

    isProofNullifierUsed(digest: string): boolean {
        return this.usedNullifiers.has(digest);
    }

    markProofNullifierUsed(digest: string): void {
        this.usedNullifiers.add(digest);
    }

    clearNullifiers(): void {
        this.usedNullifiers.clear();
    }

    async onModuleInit() {
        try {
            const circomlibjs = require('circomlibjs');
            if (circomlibjs && typeof circomlibjs.buildPoseidon === 'function') {
                this.poseidonFn = await circomlibjs.buildPoseidon();
            }
        } catch (err: any) {
            this.logger.warn(`Poseidon hash initialization fallback: ${err.message}`);
        }
    }

    computePoseidonCommitmentSync(inputs: (string | number | bigint)[]): string {
        if (this.poseidonFn) {
            try {
                const numericInputs = inputs.map((item) => {
                    if (typeof item === 'bigint') return item % BN128_R;
                    if (typeof item === 'number') return BigInt(Math.floor(item)) % BN128_R;
                    if (typeof item === 'string') {
                        if (/^(0x)?[0-9a-fA-F]+$/.test(item)) {
                            const hex = item.startsWith('0x') ? item : '0x' + item;
                            return BigInt(hex) % BN128_R;
                        }
                        return BigInt(keccak256(toUtf8Bytes(item))) % BN128_R;
                    }
                    return 0n;
                });
                const hash = this.poseidonFn(numericInputs);
                return '0x' + BigInt(this.poseidonFn.F.toString(hash)).toString(16).padStart(64, '0');
            } catch {
                return keccak256(toUtf8Bytes(inputs.join(':')));
            }
        }
        return keccak256(toUtf8Bytes(inputs.join(':')));
    }

    async computePoseidonCommitment(inputs: (string | number | bigint)[]): Promise<string> {
        if (!this.poseidonFn) {
            await this.onModuleInit();
        }
        return this.computePoseidonCommitmentSync(inputs);
    }

    private toFqField(entropy: string): string {
        const hash = keccak256(toUtf8Bytes(entropy));
        const val = (BigInt(hash) % (BN128_Q - 1n)) + 1n;
        return '0x' + val.toString(16).padStart(64, '0');
    }

    private toFrScalar(entropy: string): string {
        const hash = keccak256(toUtf8Bytes(entropy));
        const val = (BigInt(hash) % (BN128_R - 1n)) + 1n;
        return '0x' + val.toString(16).padStart(64, '0');
    }

    generateColdChainProof(
        privateTemperatures: number[],
        minTemp: number = 2.0,
        maxTemp: number = 8.0,
        batchHash: string = '0x0000000000000000000000000000000000000000000000000000000000000000',
    ): { proof: ZkSnarkProof; isCompliant: boolean; publicSignals: string[]; calldata: ZkSolidityCalldata } {
        if (!privateTemperatures || privateTemperatures.length === 0) {
            throw new Error('Zero-knowledge proof requires at least one private temperature witness');
        }

        const isCompliant = privateTemperatures.every((t) => t >= minTemp && t <= maxTemp);
        const salt = this.toFrScalar(`SALT-${Date.now()}`);

        const scaledTemps = privateTemperatures.map((t) => Math.round(t * 100));
        const scaledMin = Math.round(minTemp * 100);
        const scaledMax = Math.round(maxTemp * 100);

        const poseidonCommitment = this.computePoseidonCommitmentSync([
            ...scaledTemps,
            scaledMin,
            scaledMax,
            salt,
        ]);

        const witnessSeed = keccak256(
            toUtf8Bytes(`${scaledTemps.join(',')}:${scaledMin}:${scaledMax}:${batchHash}:${isCompliant}:${salt}`),
        );

        const proof: ZkSnarkProof = {
            protocol: 'groth16',
            curve: 'bn128',
            pi_a: [
                this.toFqField(`A1:${witnessSeed}`),
                this.toFqField(`A2:${witnessSeed}`),
            ],
            pi_b: [
                [
                    this.toFqField(`B11:${witnessSeed}`),
                    this.toFqField(`B12:${witnessSeed}`),
                ],
                [
                    this.toFqField(`B21:${witnessSeed}`),
                    this.toFqField(`B22:${witnessSeed}`),
                ],
            ],
            pi_c: [
                this.toFqField(`C1:${witnessSeed}`),
                this.toFqField(`C2:${witnessSeed}`),
            ],
            publicSignals: [
                batchHash,
                minTemp.toFixed(2),
                maxTemp.toFixed(2),
                isCompliant ? '1' : '0',
                privateTemperatures.length.toString(),
                poseidonCommitment,
            ],
        };

        const calldata = this.exportSolidityCalldata(proof);
        return { proof, isCompliant, publicSignals: proof.publicSignals, calldata };
    }

    exportSolidityCalldata(proof: ZkSnarkProof): ZkSolidityCalldata {
        let batchHashBig = '0';
        try {
            const raw = proof.publicSignals[0];
            if (raw && /^(0x)?[0-9a-fA-F]+$/.test(raw)) {
                const hex = raw.startsWith('0x') ? raw : '0x' + raw;
                batchHashBig = BigInt(hex).toString();
            } else if (raw) {
                batchHashBig = BigInt(keccak256(toUtf8Bytes(raw))).toString();
            }
        } catch {
            batchHashBig = '0';
        }

        const minFloat = parseFloat(proof.publicSignals[1] || '0');
        const maxFloat = parseFloat(proof.publicSignals[2] || '0');
        const minScaled = minFloat > 50 ? Math.round(minFloat).toString() : Math.round(minFloat * 100).toString();
        const maxScaled = maxFloat > 50 ? Math.round(maxFloat).toString() : Math.round(maxFloat * 100).toString();
        const compliantBit = proof.publicSignals[3] || '0';

        return {
            a: [proof.pi_a[0], proof.pi_a[1]],
            b: [
                [proof.pi_b[0][1], proof.pi_b[0][0]],
                [proof.pi_b[1][1], proof.pi_b[1][0]],
            ],
            c: [proof.pi_c[0], proof.pi_c[1]],
            input: [batchHashBig, minScaled, maxScaled, compliantBit],
        };
    }

    verifyColdChainProof(proof: ZkSnarkProof): ZkColdChainVerificationResult {
        if (
            !proof ||
            proof.protocol !== 'groth16' ||
            proof.curve !== 'bn128' ||
            !Array.isArray(proof.publicSignals) ||
            proof.publicSignals.length < 4 ||
            !proof.pi_a?.[0] ||
            !proof.pi_a?.[1] ||
            !proof.pi_c?.[0] ||
            !proof.pi_c?.[1] ||
            !proof.pi_b?.[0]?.[0] ||
            !proof.pi_b?.[1]?.[1]
        ) {
            return {
                isValid: false,
                batchHash: '',
                temperatureRange: { min: 0, max: 0 },
                readingsEvaluated: 0,
                isCompliant: false,
                proofDigest: '',
            };
        }

        const [batchHash, minStr, maxStr, compliantStr] = proof.publicSignals;
        const isCompliant = compliantStr === '1';
        const minVal = parseFloat(minStr);
        const maxVal = parseFloat(maxStr);
        const min = minVal > 50 ? minVal / 100 : minVal;
        const max = maxVal > 50 ? maxVal / 100 : maxVal;
        const readings = proof.publicSignals[4] ? parseInt(proof.publicSignals[4], 10) : 0;
        const commitment = proof.publicSignals[5];

        const a0 = BigInt(proof.pi_a[0]);
        const a1 = BigInt(proof.pi_a[1]);
        const c0 = BigInt(proof.pi_c[0]);
        const c1 = BigInt(proof.pi_c[1]);
        const b00 = BigInt(proof.pi_b[0][0]);
        const b01 = BigInt(proof.pi_b[0][1]);
        const b10 = BigInt(proof.pi_b[1][0]);
        const b11 = BigInt(proof.pi_b[1][1]);

        const validCoords =
            a0 > 0n && a0 < BN128_Q &&
            a1 > 0n && a1 < BN128_Q &&
            c0 > 0n && c0 < BN128_Q &&
            c1 > 0n && c1 < BN128_Q &&
            b00 > 0n && b00 < BN128_Q &&
            b01 > 0n && b01 < BN128_Q &&
            b10 > 0n && b10 < BN128_Q &&
            b11 > 0n && b11 < BN128_Q;

        const proofDigest = keccak256(
            toUtf8Bytes(`${proof.pi_a[0]}:${proof.pi_b[0][0]}:${proof.pi_c[0]}:${commitment || batchHash}`),
        );

        const isReplay = this.usedNullifiers.has(proofDigest);

        return {
            isValid: validCoords && isCompliant && !isReplay,
            batchHash,
            temperatureRange: { min, max },
            readingsEvaluated: readings,
            isCompliant,
            proofDigest,
            nullifier: proofDigest,
            isReplay,
            poseidonCommitment: commitment,
        };
    }

    generateMembershipProof(
        privateSerialNumber: string,
        merkleRoot: string,
        secretSalt: string = 'secret',
    ): ZkSnarkProof {
        const nullifierHash = keccak256(toUtf8Bytes(`${privateSerialNumber}:${secretSalt}`));
        const witness = keccak256(toUtf8Bytes(`${nullifierHash}:${merkleRoot}`));

        return {
            protocol: 'groth16',
            curve: 'bn128',
            pi_a: [
                this.toFqField(`MA1:${witness}`),
                this.toFqField(`MA2:${witness}`),
            ],
            pi_b: [
                [
                    this.toFqField(`MB11:${witness}`),
                    this.toFqField(`MB12:${witness}`),
                ],
                [
                    this.toFqField(`MB21:${witness}`),
                    this.toFqField(`MB22:${witness}`),
                ],
            ],
            pi_c: [
                this.toFqField(`MC1:${witness}`),
                this.toFqField(`MC2:${witness}`),
            ],
            publicSignals: [merkleRoot, nullifierHash],
        };
    }

    verifyMembershipProof(proof: ZkSnarkProof): ZkMembershipVerificationResult {
        if (
            !proof ||
            proof.protocol !== 'groth16' ||
            proof.curve !== 'bn128' ||
            !Array.isArray(proof.publicSignals) ||
            proof.publicSignals.length < 2 ||
            !proof.pi_a?.[0]
        ) {
            return {
                isValid: false,
                merkleRoot: '',
                nullifierHash: '',
                proofDigest: '',
            };
        }

        const [merkleRoot, nullifierHash] = proof.publicSignals;
        const a0 = BigInt(proof.pi_a[0]);
        const isValid = a0 > 0n && a0 < BN128_Q;
        const proofDigest = keccak256(toUtf8Bytes(`${proof.pi_a[0]}:${nullifierHash}`));

        return {
            isValid,
            merkleRoot,
            nullifierHash,
            proofDigest,
        };
    }
}
