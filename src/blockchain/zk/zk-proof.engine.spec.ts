import { Test, TestingModule } from '@nestjs/testing';
import { ZkProofEngine } from './zk-proof.engine';

describe('ZkProofEngine', () => {
    let engine: ZkProofEngine;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ZkProofEngine],
        }).compile();

        engine = module.get<ZkProofEngine>(ZkProofEngine);
        await engine.onModuleInit();
    });

    it('should be defined', () => {
        expect(engine).toBeDefined();
    });

    it('should compute Poseidon hash commitment', async () => {
        const commitment = await engine.computePoseidonCommitment([250, 450, 600, 1n]);
        expect(commitment).toBeDefined();
        expect(commitment.startsWith('0x')).toBe(true);
        expect(commitment.length).toBe(66);
    });

    it('should generate automated Groth16 proof for compliant temperature telemetry', async () => {
        const readings = [2.5, 3.1, 4.0, 5.2, 4.8];
        const minTemp = 2.0;
        const maxTemp = 8.0;
        const batchHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

        const { proof, isCompliant, publicSignals, calldata } = await engine.generateColdChainProof(
            readings,
            minTemp,
            maxTemp,
            batchHash,
        );

        expect(proof).toBeDefined();
        expect(proof.protocol).toBe('groth16');
        expect(proof.curve).toBe('bn128');
        expect(isCompliant).toBe(true);
        expect(publicSignals[3]).toBe('1');
        expect(proof.pi_a).toHaveLength(2);
        expect(proof.pi_b).toHaveLength(2);
        expect(proof.pi_c).toHaveLength(2);

        expect(calldata).toBeDefined();
        expect(calldata.a).toHaveLength(2);
        expect(calldata.b).toHaveLength(2);
        expect(calldata.c).toHaveLength(2);
        expect(calldata.input).toHaveLength(4);
        expect(calldata.input[3]).toBe('1');
    });

    it('should generate proof reflecting non-compliance when temperature excursion occurs', async () => {
        const excursionReadings = [2.5, 3.1, 9.8, 5.2, 4.8];
        const minTemp = 2.0;
        const maxTemp = 8.0;
        const batchHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

        const { proof, isCompliant, publicSignals, calldata } = await engine.generateColdChainProof(
            excursionReadings,
            minTemp,
            maxTemp,
            batchHash,
        );

        expect(isCompliant).toBe(false);
        expect(publicSignals[3]).toBe('0');
        expect(calldata.input[3]).toBe('0');

        const verification = await engine.verifyColdChainProof(proof);
        expect(verification.isCompliant).toBe(false);
        expect(verification.isValid).toBe(false);
    });

    it('should reject proof generation with empty witness readings', () => {
        expect(() => engine.generateColdChainProof([])).toThrow(
            'Zero-knowledge proof requires at least one private temperature witness',
        );
    });

    it('should verify a valid compliant cold chain proof', async () => {
        const readings = [3.5, 4.1, 4.5, 5.0];
        const { proof } = await engine.generateColdChainProof(readings, 2.0, 8.0);

        const result = await engine.verifyColdChainProof(proof);
        expect(result.isValid).toBe(true);
        expect(result.isCompliant).toBe(true);
        expect(result.proofDigest).toBeDefined();
    });

    it('should reject malformed or tampered proof object', async () => {
        const invalidProof: any = {
            protocol: 'plonk',
            curve: 'bn128',
            publicSignals: [],
        };

        const result = await engine.verifyColdChainProof(invalidProof);
        expect(result.isValid).toBe(false);
    });

    it('should generate and verify zero-knowledge membership proof', () => {
        const serialNumber = 'SN-2026-VAX-001';
        const merkleRoot = '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';

        const proof = engine.generateMembershipProof(serialNumber, merkleRoot);
        expect(proof).toBeDefined();
        expect(proof.publicSignals[0]).toBe(merkleRoot);

        const result = engine.verifyMembershipProof(proof);
        expect(result.isValid).toBe(true);
        expect(result.merkleRoot).toBe(merkleRoot);
    });

    it('should export correct Solidity calldata format matching ZkColdChainVerifier', async () => {
        const readings = [3.0, 4.0, 5.0];
        const { proof } = await engine.generateColdChainProof(readings, 2.0, 8.0);
        const calldata = engine.exportSolidityCalldata(proof);

        expect(calldata.a[0].startsWith('0x')).toBe(true);
        expect(calldata.a[1].startsWith('0x')).toBe(true);
        expect(calldata.b[0][0].startsWith('0x')).toBe(true);
        expect(calldata.c[0].startsWith('0x')).toBe(true);
        expect(calldata.input[1]).toBe('200');
        expect(calldata.input[2]).toBe('800');
        expect(calldata.input[3]).toBe('1');
    });
});
