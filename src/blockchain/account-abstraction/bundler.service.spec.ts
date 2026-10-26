import { BundlerService } from './bundler.service';
import { PaymasterService } from './paymaster.service';

describe('BundlerService', () => {
    let paymasterService: PaymasterService;
    let bundlerService: BundlerService;

    const sampleSender = '0x1111111111111111111111111111111111111111';

    beforeEach(() => {
        paymasterService = new PaymasterService();
        bundlerService = new BundlerService(paymasterService);
    });

    it('should estimate gas limits for UserOperation', () => {
        const gas = bundlerService.estimateUserOpGas({
            callData: '0x1234567890abcdef',
        });

        expect(gas.callGasLimit).toBeGreaterThan(50000);
        expect(gas.verificationGasLimit).toBe(150000);
        expect(gas.preVerificationGas).toBe(45000);
    });

    it('should stage valid sponsored UserOperation into bundler mempool', async () => {
        const userOpDraft = {
            sender: sampleSender,
            nonce: 0,
            initCode: '0x',
            callData: '0x',
            callGasLimit: 200000,
            verificationGasLimit: 100000,
            preVerificationGas: 50000,
            maxFeePerGas: 2000000000,
            maxPriorityFeePerGas: 1000000000,
        };

        const sponsorship = await paymasterService.sponsorUserOperation(userOpDraft, 'packBatch');
        const userOp = {
            ...userOpDraft,
            paymasterAndData: sponsorship.paymasterAndData,
            signature: '0x',
        };

        const result = bundlerService.sendUserOperation(userOp);
        expect(result.queued).toBe(true);
        expect(result.userOpHash).toBeDefined();

        const status = bundlerService.getMempoolStatus();
        expect(status.pendingCount).toBe(1);
        expect(status.pendingUserOpHashes).toContain(result.userOpHash);
    });

    it('should reject UserOperation with invalid sender address', () => {
        expect(() => {
            bundlerService.sendUserOperation({
                sender: 'invalid-address',
                nonce: 0,
                initCode: '0x',
                callData: '0x',
                callGasLimit: 100000,
                verificationGasLimit: 50000,
                preVerificationGas: 20000,
                maxFeePerGas: 2000000000,
                maxPriorityFeePerGas: 1000000000,
                paymasterAndData: '0x',
                signature: '0x',
            });
        }).toThrow('Invalid or missing UserOperation sender address');
    });

    it('should bundle multiple mempool UserOperations and execute batch', async () => {
        for (let i = 0; i < 3; i++) {
            const userOpDraft = {
                sender: sampleSender,
                nonce: i,
                initCode: '0x',
                callData: `0x000${i}`,
                callGasLimit: 200000,
                verificationGasLimit: 100000,
                preVerificationGas: 50000,
                maxFeePerGas: 2000000000,
                maxPriorityFeePerGas: 1000000000,
            };

            const sponsorship = await paymasterService.sponsorUserOperation(userOpDraft, 'shipTransit');
            bundlerService.sendUserOperation({
                ...userOpDraft,
                paymasterAndData: sponsorship.paymasterAndData,
                signature: '0x',
            });
        }

        expect(bundlerService.getMempoolStatus().pendingCount).toBe(3);

        const bundle = bundlerService.createBundle(5);
        expect(bundle.operations.length).toBe(3);
        expect(bundle.status).toBe('QUEUED');
        expect(bundlerService.getMempoolStatus().pendingCount).toBe(0);

        const simulation = bundlerService.simulateBundle(bundle);
        expect(simulation.simulatedOk).toBe(true);
        expect(simulation.validOpsCount).toBe(3);

        const execution = await bundlerService.executeBundle(bundle);
        expect(execution.executedCount).toBe(3);
        expect(execution.transactionHash).toBeDefined();

        const firstOpReceipt = bundlerService.getUserOpReceipt(execution.receipts[0].userOpHash);
        expect(firstOpReceipt.success).toBe(true);
        expect(firstOpReceipt.sender).toBe(sampleSender);
    });

    it('should reject bundle creation if mempool is empty', () => {
        expect(() => {
            bundlerService.createBundle();
        }).toThrow('Bundler mempool is empty; no UserOperations to bundle');
    });
});
