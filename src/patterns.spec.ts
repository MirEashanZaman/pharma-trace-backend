import { EventStrategyFactory } from './events/strategies/event-strategy.factory';
import { ManufacturedStrategy } from './events/strategies/manufactured.strategy';
import { ShippedStrategy } from './events/strategies/shipped.strategy';
import { ReceivedStrategy } from './events/strategies/received.strategy';
import { TemperatureMonitoredStrategy } from './events/strategies/temperature-monitored.strategy';
import { ComplianceDossierBuilder } from './drugs/builders/compliance-dossier.builder';
import { IotSensorAdapter } from './iot/adapters/iot-sensor.adapter';
import { ColdChainCircuitBreaker } from './iot/circuit-breaker/cold-chain.circuit-breaker';
import { BlockchainFacade } from './blockchain/blockchain.facade';
import { AuditObserver } from './events/observers/audit.observer';
import { CustodyTransferSaga } from './events/saga/custody-transfer.saga';
import { CustodyRollbackEngine } from './events/saga/custody-rollback.engine';
import { RpcLoadBalancer } from './blockchain/load-balancer/rpc-load-balancer';
import { MerkleTree } from './blockchain/merkle/merkle-tree';
import { BatchAttestationEngine } from './blockchain/merkle/batch-attestation.engine';
import { Eip712CustodyService, CUSTODY_TYPED_DATA_TYPES } from './blockchain/eip712/eip712-custody';
import { EpcisAggregator } from './blockchain/epcis/epcis-aggregator';
import { PackagingLevel } from './blockchain/epcis/epcis-hierarchy.types';
import { HardwareOracleService } from './iot/oracle/hardware-oracle.service';
import { IpfsService } from './blockchain/ipfs/ipfs.service';
import { ZkProofEngine } from './blockchain/zk/zk-proof.engine';
import { PaymasterService } from './blockchain/account-abstraction/paymaster.service';
import { SoulboundAccreditationService, AccreditationType } from './blockchain/sbt/soulbound-accreditation.service';
import { EventType } from './events/event-type.enum';
import { UserRole } from './auth/entities/user.entity';
import { ethers } from 'ethers';

describe('Software Architecture & Design Patterns Specification Suite', () => {
    describe('1. Strategy Pattern & Strategy Factory', () => {
        const factory = new EventStrategyFactory(
            new ManufacturedStrategy(),
            new ShippedStrategy(),
            new ReceivedStrategy(),
            new TemperatureMonitoredStrategy(),
        );

        it('should resolve ManufacturedStrategy for MANUFACTURED events', () => {
            const strategy = factory.getStrategy('MANUFACTURED');
            expect(strategy).toBeDefined();
            expect(strategy instanceof ManufacturedStrategy).toBe(true);
        });

        it('should resolve ShippedStrategy for SHIPPED events', () => {
            const strategy = factory.getStrategy('SHIPPED');
            expect(strategy).toBeDefined();
            expect(strategy instanceof ShippedStrategy).toBe(true);
        });

        it('should resolve ReceivedStrategy for RECEIVED events', () => {
            const strategy = factory.getStrategy('RECEIVED');
            expect(strategy).toBeDefined();
            expect(strategy instanceof ReceivedStrategy).toBe(true);
        });

        it('should resolve TemperatureMonitoredStrategy for TEMPERATURE_MONITORED events', () => {
            const strategy = factory.getStrategy('TEMPERATURE_MONITORED');
            expect(strategy).toBeDefined();
            expect(strategy instanceof TemperatureMonitoredStrategy).toBe(true);
        });
    });

    describe('2. Builder Pattern', () => {
        it('should construct a verified GxP compliance dossier step-by-step', () => {
            const mockDrug: any = {
                id: 1,
                serialNumber: 'SN-2026-TEST',
                drugName: 'Ceftriaxone 1g Vial',
                manufacturer: 'Certified BioPharma Ltd',
                batchNumber: 'BATCH-2026-X1',
                createdAt: new Date('2026-01-01T00:00:00Z'),
            };

            const mockEvents: any[] = [
                {
                    id: 'ev-1',
                    eventType: 'MANUFACTURED',
                    createdAt: '2026-01-01T02:00:00Z',
                    eventHash: '0xhash1',
                    eventData: {
                        temperature: 4.5,
                        humidity: 45,
                        handlerName: 'Production Line #3',
                        handlerRole: 'MANUFACTURER',
                    },
                },
                {
                    id: 'ev-2',
                    eventType: 'IN_TRANSIT',
                    createdAt: '2026-01-01T05:00:00Z',
                    eventHash: '0xhash2',
                    eventData: {
                        temperature: 5.1,
                        humidity: 48,
                        location: 'Interstate Reefer #90',
                        handlerRole: 'DISTRIBUTOR',
                    },
                },
            ];

            const dossier = new ComplianceDossierBuilder()
                .setDrug(mockDrug)
                .setEvents(mockEvents)
                .setStandard('FDA 21 CFR Part 11 / WHO TRS 961')
                .setInspectorAuthority('FDA Digital Inspection Service')
                .build();

            expect(dossier.serialNumber).toBe('SN-2026-TEST');
            expect(dossier.drugName).toBe('Ceftriaxone 1g Vial');
            expect(dossier.complianceSummary.disposition).toBe('FULLY_COMPLIANT');
            expect(dossier.complianceSummary.compliancePercentage).toBe(100);
            expect(dossier.complianceSummary.totalEvents).toBe(2);
            expect(dossier.complianceSummary.minTemperature).toBe(4.5);
            expect(dossier.complianceSummary.maxTemperature).toBe(5.1);
            expect(dossier.custodyTimeline.length).toBe(2);
            expect(dossier.custodyTimeline[0].eventType).toBe('MANUFACTURED');
        });
    });

    describe('3. Adapter Pattern', () => {
        const adapter = new IotSensorAdapter();

        it('should adapt raw hardware ESP32 string telemetry into domain format', () => {
            const rawString = 'DEVICE:ESP32-VAN408;SERIAL:SN-2026-AMOX500;TEMP:4.8;HUM:52;LOC:Depot Loading Dock';
            const normalized = adapter.adaptRawDeviceString(rawString);

            expect(normalized.serialNumber).toBe('SN-2026-AMOX500');
            expect(normalized.temperature).toBe(4.8);
            expect(normalized.humidity).toBe(52);
            expect(normalized.location).toBe('Depot Loading Dock');
            expect(normalized.sourceProtocol).toBe('ESP32_RAW');
        });

        it('should adapt industrial Modbus register arrays into domain format', () => {
            const registers = [46, 510, 88];
            const normalized = adapter.adaptModbusRegisters('SN-2026-INSULIN100', registers);

            expect(normalized.serialNumber).toBe('SN-2026-INSULIN100');
            expect(normalized.temperature).toBe(4.6);
            expect(normalized.humidity).toBe(51.0);
            expect(normalized.location).toBe('Depot Sector #88');
            expect(normalized.sourceProtocol).toBe('MODBUS_PLC');
        });

        it('should adapt standard JSON sensor inputs', () => {
            const jsonPayload = {
                serialNumber: 'SN-2026-VAX',
                temp: '3.9',
                hum: '46',
                location: 'Cross-Dock Hub B',
            };
            const normalized = adapter.adaptJsonPayload(jsonPayload);

            expect(normalized.serialNumber).toBe('SN-2026-VAX');
            expect(normalized.temperature).toBe(3.9);
            expect(normalized.humidity).toBe(46);
            expect(normalized.sourceProtocol).toBe('REST_JSON');
        });
    });

    describe('4. Circuit Breaker Pattern', () => {
        it('should remain CLOSED under nominal operating temperatures (2C to 8C)', () => {
            const breaker = new ColdChainCircuitBreaker(3);
            breaker.recordTemperature(4.2);
            breaker.recordTemperature(5.5);
            const status = breaker.recordTemperature(3.8);

            expect(status.state).toBe('CLOSED');
            expect(status.isTripActive).toBe(false);
            expect(breaker.isBlocked()).toBe(false);
        });

        it('should trip to OPEN state when consecutive excursion threshold is breached', () => {
            const breaker = new ColdChainCircuitBreaker(3);
            breaker.recordTemperature(14.5);
            breaker.recordTemperature(16.0);
            const status = breaker.recordTemperature(15.2);

            expect(status.state).toBe('OPEN');
            expect(status.isTripActive).toBe(true);
            expect(breaker.isBlocked()).toBe(true);
            expect(status.consecutiveExcursions).toBe(3);
        });

        it('should allow recovery via HALF_OPEN probe reset', () => {
            const breaker = new ColdChainCircuitBreaker(2);
            breaker.manualTrip(18.0);
            expect(breaker.isBlocked()).toBe(true);

            breaker.attemptReset();
            expect(breaker.getStatus().state).toBe('HALF_OPEN');

            breaker.recordTemperature(4.5);
            expect(breaker.getStatus().state).toBe('CLOSED');
            expect(breaker.isBlocked()).toBe(false);
        });
    });

    describe('5. Facade Pattern', () => {
        it('should provide unified blockchain attestation interface', async () => {
            const mockBlockchainService: any = {
                anchorAttestation: jest.fn().mockResolvedValue({
                    isRevoked: false,
                    transactionHash: '0x123abc456def',
                    blockNumber: 42091,
                    timestamp: 1774000000,
                }),
                verifyAttestation: jest.fn().mockResolvedValue({
                    exists: true,
                    isValid: true,
                    drugSerialNumber: 'SN-2026-AMOX500',
                    eventType: 'MANUFACTURED',
                    signer: '0xabc123',
                    timestamp: 1774000000,
                    metadataUri: 'ipfs://0xhash',
                    onChain: true,
                }),
            };

            const facade = new BlockchainFacade(mockBlockchainService);

            const anchorResult = await facade.anchorEventProof('SN-2026-AMOX500', 'MANUFACTURED', '0xeventhash123');
            expect(anchorResult.success).toBe(true);
            expect(anchorResult.txHash).toBe('0x123abc456def');
            expect(anchorResult.blockNumber).toBe(42091);

            const verifyResult = await facade.verifyAttestation('0xeventhash123');
            expect(verifyResult.exists).toBe(true);
            expect(verifyResult.drugSerialNumber).toBe('SN-2026-AMOX500');
        });
    });

    describe('6. Observer Pattern', () => {
        it('should execute audit observer notification upon event emit', () => {
            const observer = new AuditObserver();
            const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

            observer.update({
                eventType: EventType.MANUFACTURED,
                drugSerialNumber: 'SN-2026-AMOX500',
            } as any);

            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('7. Saga Pattern', () => {
        it('should enforce state machine lifecycle rules in CustodyTransferSaga', () => {
            const saga = new CustodyTransferSaga();

            expect(() =>
                saga.validateTransition(
                    EventType.MANUFACTURED,
                    EventType.QUALITY_CHECKED,
                    UserRole.MANUFACTURER,
                ),
            ).not.toThrow();

            expect(() =>
                saga.validateTransition(
                    EventType.QUALITY_CHECKED,
                    EventType.PACKAGED,
                    UserRole.MANUFACTURER,
                ),
            ).not.toThrow();
        });
    });

    describe('8. Load Balancer Pattern', () => {
        it('should cycle through healthy nodes using round-robin distribution', () => {
            const lb = new RpcLoadBalancer();
            const node1 = lb.selectNode('ROUND_ROBIN');
            const node2 = lb.selectNode('ROUND_ROBIN');
            const node3 = lb.selectNode('ROUND_ROBIN');

            expect(node1).toBeDefined();
            expect(node2).toBeDefined();
            expect(node3).toBeDefined();
            expect(node1.id).not.toBe(node2.id);
        });

        it('should execute operation with failover when primary node fails', async () => {
            const lb = new RpcLoadBalancer();
            let attempts = 0;

            const { result, servedBy } = await lb.executeWithFailover(async (node) => {
                attempts++;
                if (node.id === 'rpc-primary-local') {
                    throw new Error('RPC Connection Timed Out (504)');
                }
                return `Success from ${node.name}`;
            }, 'PRIORITY_FAILOVER');

            expect(attempts).toBe(2);
            expect(result).toContain('Success from');
            expect(servedBy.id).toBe('rpc-secondary-sepolia');
        });

        it('should trip an unhealthy node after reaching failure threshold', () => {
            const lb = new RpcLoadBalancer();
            lb.recordFailure('rpc-primary-local');
            lb.recordFailure('rpc-primary-local');
            lb.recordFailure('rpc-primary-local');

            const status = lb.getPoolStatus();
            const primary = status.find((n) => n.id === 'rpc-primary-local');
            expect(primary?.isHealthy).toBe(false);
            expect(primary?.consecutiveFailures).toBe(3);
        });
    });

    describe('9. Saga Compensating Rollback Pattern', () => {
        const rollbackEngine = new CustodyRollbackEngine();

        it('should determine appropriate compensating reversal action for failed SOLD event', () => {
            const plan = rollbackEngine.getCompensatingAction(EventType.SOLD);
            expect(plan.failedEventType).toBe(EventType.SOLD);
            expect(plan.restoredState).toBe(EventType.DISTRIBUTED);
            expect(plan.compensatingEventType).toBe(EventType.QUARANTINED);
        });

        it('should determine appropriate compensating reversal action for failed SHIPPED event', () => {
            const plan = rollbackEngine.getCompensatingAction(EventType.SHIPPED);
            expect(plan.failedEventType).toBe(EventType.SHIPPED);
            expect(plan.restoredState).toBe(EventType.PACKAGED);
            expect(plan.requiresRegulatorySignoff).toBe(true);
        });

        it('should execute compensating rollback and generate structured audit report', () => {
            const report = rollbackEngine.executeRollback(
                'SN-2026-AMOX500',
                EventType.SHIPPED,
                'Temperature sensor detected severe excursion > 16°C during loading transit',
                'Cold-Chain Regulatory Agent #408',
            );

            expect(report.rollbackId).toMatch(/^ROLLBACK-/);
            expect(report.serialNumber).toBe('SN-2026-AMOX500');
            expect(report.failedEvent).toBe(EventType.SHIPPED);
            expect(report.restoredCustodyState).toBe(EventType.PACKAGED);
            expect(report.isCompensated).toBe(true);
            expect(report.initiatedBy).toBe('Cold-Chain Regulatory Agent #408');
        });
    });

    describe('10. Merkle Tree & Batch Attestation Pattern', () => {
        const engine = new BatchAttestationEngine();
        const items = [
            { serialNumber: 'SN-001', eventType: 'MANUFACTURED', dataHash: '0x1111111111111111111111111111111111111111111111111111111111111111', timestamp: 1000 },
            { serialNumber: 'SN-002', eventType: 'MANUFACTURED', dataHash: '0x2222222222222222222222222222222222222222222222222222222222222222', timestamp: 1001 },
            { serialNumber: 'SN-003', eventType: 'MANUFACTURED', dataHash: '0x3333333333333333333333333333333333333333333333333333333333333333', timestamp: 1002 },
            { serialNumber: 'SN-004', eventType: 'MANUFACTURED', dataHash: '0x4444444444444444444444444444444444444444444444444444444444444444', timestamp: 1003 },
        ];

        it('should build Merkle tree and verify valid inclusion proof for item', () => {
            const batch = engine.createBatch(items);
            expect(batch.merkleRoot).toBeDefined();
            expect(batch.batchSize).toBe(4);
            expect(batch.ipfsCid).toMatch(/^ipfs:\/\/bafy/);

            const verification = engine.verifyItemInclusion('SN-002', items[1]);
            expect(verification.isValid).toBe(true);
            expect(verification.merkleRoot).toBe(batch.merkleRoot);
            expect(verification.proof.length).toBeGreaterThan(0);
        });

        it('should reject forged inclusion proof with altered item data', () => {
            const batch = engine.createBatch(items);
            const forgedItem = { ...items[1], dataHash: '0x9999999999999999999999999999999999999999999999999999999999999999' };
            const forgedLeaf = engine.computeLeaf(forgedItem);
            const legitimateProof = engine.getProofForItem(batch.batchId, items[1]);

            const isValid = MerkleTree.verifyProof(forgedLeaf, legitimateProof, batch.merkleRoot);
            expect(isValid).toBe(false);
        });
    });

    describe('11. EIP-712 Dual Custody Handshake Pattern', () => {
        const eip712Service = new Eip712CustodyService();
        const manufacturerWallet = ethers.Wallet.createRandom();
        const distributorWallet = ethers.Wallet.createRandom();
        const contractAddress = '0x1234567890123456789012345678901234567890';
        const chainId = 31337;

        it('should validate dual handshake when both parties sign structured EIP-712 payloads', async () => {
            const domain = eip712Service.getDomain(contractAddress, chainId);
            const offer = {
                drugSerialNumber: 'SN-EIP712-VAXX-001',
                fromAddress: manufacturerWallet.address,
                toAddress: distributorWallet.address,
                roleFrom: 'MANUFACTURER',
                roleTo: 'DISTRIBUTOR',
                nonce: 1,
                expiry: Date.now() + 60000,
            };

            const accept = {
                drugSerialNumber: 'SN-EIP712-VAXX-001',
                fromAddress: manufacturerWallet.address,
                toAddress: distributorWallet.address,
                conditionAccepted: true,
                nonce: 1,
                expiry: Date.now() + 60000,
            };

            const offerSig = await manufacturerWallet.signTypedData(
                domain,
                { CustodyTransferOffer: CUSTODY_TYPED_DATA_TYPES.CustodyTransferOffer },
                offer,
            );

            const acceptSig = await distributorWallet.signTypedData(
                domain,
                { CustodyTransferAccept: CUSTODY_TYPED_DATA_TYPES.CustodyTransferAccept },
                accept,
            );

            const result = eip712Service.validateDualCustodyHandshake(
                offer,
                offerSig,
                accept,
                acceptSig,
                contractAddress,
                chainId,
            );

            expect(result.isValid).toBe(true);
            expect(result.offerVerified).toBe(true);
            expect(result.acceptVerified).toBe(true);
            expect(result.matchedSerial).toBe('SN-EIP712-VAXX-001');
        });

        it('should reject handshake when destination recipient rejects temperature/condition', async () => {
            const domain = eip712Service.getDomain(contractAddress, chainId);
            const offer = {
                drugSerialNumber: 'SN-EIP712-VAXX-002',
                fromAddress: manufacturerWallet.address,
                toAddress: distributorWallet.address,
                roleFrom: 'MANUFACTURER',
                roleTo: 'DISTRIBUTOR',
                nonce: 2,
                expiry: Date.now() + 60000,
            };

            const accept = {
                drugSerialNumber: 'SN-EIP712-VAXX-002',
                fromAddress: manufacturerWallet.address,
                toAddress: distributorWallet.address,
                conditionAccepted: false,
                nonce: 2,
                expiry: Date.now() + 60000,
            };

            const offerSig = await manufacturerWallet.signTypedData(
                domain,
                { CustodyTransferOffer: CUSTODY_TYPED_DATA_TYPES.CustodyTransferOffer },
                offer,
            );

            const acceptSig = await distributorWallet.signTypedData(
                domain,
                { CustodyTransferAccept: CUSTODY_TYPED_DATA_TYPES.CustodyTransferAccept },
                accept,
            );

            const result = eip712Service.validateDualCustodyHandshake(
                offer,
                offerSig,
                accept,
                acceptSig,
                contractAddress,
                chainId,
            );

            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('Invalid or expired transfer acceptance signature');
        });
    });

    describe('12. GS1 EPCIS Packaging Aggregation Hierarchy Pattern', () => {
        const aggregator = new EpcisAggregator();

        it('should aggregate unit items into case and case into pallet logistics unit', () => {
            aggregator.registerItem('SGTIN-101', 'GTIN-001', 'LOT-99', 'GLN-WH-01');
            aggregator.registerItem('SGTIN-102', 'GTIN-001', 'LOT-99', 'GLN-WH-01');

            const caseEvent = aggregator.pack(
                'SSCC-CASE-501',
                PackagingLevel.CASE,
                ['SGTIN-101', 'SGTIN-102'],
                'GLN-WH-01',
            );
            expect(caseEvent.parentSscc).toBe('SSCC-CASE-501');

            const palletEvent = aggregator.pack(
                'SSCC-PALLET-901',
                PackagingLevel.PALLET,
                ['SSCC-CASE-501'],
                'GLN-WH-01',
            );
            expect(palletEvent.parentSscc).toBe('SSCC-PALLET-901');

            const trace = aggregator.traceHierarchy('SGTIN-101');
            expect(trace.ancestorSsccs).toEqual(['SSCC-CASE-501', 'SSCC-PALLET-901']);
            expect(trace.rootContainerSscc).toBe('SSCC-PALLET-901');
            expect(trace.isPackaged).toBe(true);
        });

        it('should correctly update packaging status when logistics unit is deaggregated', () => {
            const deaggregated = aggregator.deaggregate('SSCC-CASE-501');
            expect(deaggregated).toBe(true);

            const trace = aggregator.traceHierarchy('SGTIN-101');
            expect(trace.isPackaged).toBe(false);
        });
    });

    describe('13. Hardware IoT Cryptographic Oracle Pattern', () => {
        const oracle = new HardwareOracleService();
        const deviceWallet = ethers.Wallet.createRandom();
        const deviceId = 'ENCLAVE-SENSOR-ATECC608A-99';

        oracle.registerDevice(
            deviceId,
            deviceWallet.address,
            'ATECC608A-CryptoAuth',
            'ATECC608A',
        );

        it('should verify telemetry signed by authorized hardware enclave private key', async () => {
            const payloadData = {
                deviceId,
                temperature: 4.25,
                humidity: 48.5,
                timestamp: Date.now(),
                nonce: 10,
            };

            const message = oracle.formatTelemetryMessage(payloadData);
            const signature = await deviceWallet.signMessage(message);

            const report = oracle.verifyTelemetry({
                ...payloadData,
                signature,
            });

            expect(report.isValid).toBe(true);
            expect(report.deviceAddress).toBe(deviceWallet.address.toLowerCase());
            expect(report.temperature).toBe(4.25);
        });

        it('should reject telemetry replaying a previously seen nonce', async () => {
            const payloadData = {
                deviceId,
                temperature: 4.30,
                humidity: 48.0,
                timestamp: Date.now(),
                nonce: 10,
            };

            const message = oracle.formatTelemetryMessage(payloadData);
            const signature = await deviceWallet.signMessage(message);

            const report = oracle.verifyTelemetry({
                ...payloadData,
                signature,
            });

            expect(report.isValid).toBe(false);
            expect(report.reason).toContain('Anti-replay violation');
        });

        it('should reject forged telemetry with invalid signature', async () => {
            const maliciousWallet = ethers.Wallet.createRandom();
            const payloadData = {
                deviceId,
                temperature: 35.0,
                humidity: 90.0,
                timestamp: Date.now(),
                nonce: 20,
            };

            const message = oracle.formatTelemetryMessage(payloadData);
            const forgedSignature = await maliciousWallet.signMessage(message);

            const report = oracle.verifyTelemetry({
                ...payloadData,
                signature: forgedSignature,
            });

            expect(report.isValid).toBe(false);
            expect(report.reason).toContain('Signature mismatch');
        });
    });

    describe('12. IPFS Decentralized Storage Pattern', () => {
        const ipfs = new IpfsService();

        it('should pin audit dossier and return deterministic CIDv1 base32 string', async () => {
            const dossier = {
                serialNumber: 'SN-IPFS-9901',
                manufacturingLot: 'LOT-2026-ALPHA',
                inspectionAuthority: 'FDA_US',
                temperatureReadings: [4.1, 4.3, 4.2],
            };

            const pinResult = await ipfs.pinJson(dossier, 'SN-IPFS-9901-dossier');
            expect(pinResult.cid).toBeDefined();
            expect(pinResult.cid.startsWith('bafybeic')).toBe(true);
            expect(pinResult.pinStatus).toBe('PINNED');

            const retrieved = await ipfs.retrieveJson(pinResult.cid);
            expect(retrieved).toEqual(dossier);
        });

        it('should detect data corruption against stored CID hash', async () => {
            const dossier = { test: 'valid-payload' };
            const pinResult = await ipfs.pinJson(dossier);

            const isValid = ipfs.verifyCid(pinResult.cid, dossier);
            expect(isValid).toBe(true);

            const corrupted = { test: 'tampered-payload' };
            const isCorruptedValid = ipfs.verifyCid(pinResult.cid, corrupted);
            expect(isCorruptedValid).toBe(false);
        });
    });

    describe('13. Zero-Knowledge Proof Engine', () => {
        const zkEngine = new ZkProofEngine();

        it('should generate and verify compliance proof for safe temperature reading', () => {
            const { proof, isCompliant } = zkEngine.generateColdChainProof(
                [4.5, 4.2, 5.0],
                2.0,
                8.0,
                '0xbatch1234567890abcdef',
            );

            expect(isCompliant).toBe(true);
            expect(proof.protocol).toBe('groth16');
            expect(proof.publicSignals[1]).toBe('2.00');
            expect(proof.publicSignals[2]).toBe('8.00');

            const verification = zkEngine.verifyColdChainProof(proof);
            expect(verification.isValid).toBe(true);
            expect(verification.isCompliant).toBe(true);
        });

        it('should mark verification invalid for out-of-boundary temperature', () => {
            const { proof, isCompliant } = zkEngine.generateColdChainProof(
                [12.5],
                2.0,
                8.0,
                '0xbatchviolation123',
            );

            expect(isCompliant).toBe(false);

            const verification = zkEngine.verifyColdChainProof(proof);
            expect(verification.isValid).toBe(false);
            expect(verification.isCompliant).toBe(false);
        });

        it('should generate and verify zero-knowledge Merkle membership proof', () => {
            const zkProof = zkEngine.generateMembershipProof(
                'SERIAL_C',
                '0xmerkleRoot1234567890abcdef',
                'secretSalt99',
            );

            expect(zkProof.pi_a.length).toBe(2);
            expect(zkProof.publicSignals[0]).toBe('0xmerkleRoot1234567890abcdef');

            const verification = zkEngine.verifyMembershipProof(zkProof);
            expect(verification.isValid).toBe(true);
            expect(verification.merkleRoot).toBe('0xmerkleRoot1234567890abcdef');
        });
    });

    describe('14. ERC-4337 Account Abstraction Paymaster', () => {
        const paymaster = new PaymasterService();

        it('should sponsor gasless transaction for valid pharmaceutical action', async () => {
            const userOp = {
                sender: '0x1111111111111111111111111111111111111111',
                nonce: 0,
                initCode: '0x',
                callData: '0x',
                callGasLimit: 200000,
                verificationGasLimit: 100000,
                preVerificationGas: 50000,
                maxFeePerGas: BigInt(2000000000),
                maxPriorityFeePerGas: BigInt(1000000000),
            };

            const sponsorship = await paymaster.sponsorUserOperation(userOp, 'packBatch');
            expect(sponsorship.paymasterAndData).toBeDefined();
            expect(sponsorship.isSponsored).toBe(true);

            const verification = paymaster.validateSponsoredOperation({
                ...userOp,
                paymasterAndData: sponsorship.paymasterAndData,
            });
            expect(verification.isValid).toBe(true);
        });

        it('should reject gas sponsorship for unauthorized operation type', async () => {
            const userOp = {
                sender: '0x1111111111111111111111111111111111111111',
                nonce: 1,
                initCode: '0x',
                callData: '0x',
                callGasLimit: 200000,
                verificationGasLimit: 100000,
                preVerificationGas: 50000,
                maxFeePerGas: BigInt(2000000000),
                maxPriorityFeePerGas: BigInt(1000000000),
            };

            await expect(
                paymaster.sponsorUserOperation(userOp, 'unauthorizedDrainingAction'),
            ).rejects.toThrow("Action 'unauthorizedDrainingAction' is not authorized for corporate gas sponsorship");
        });
    });

    describe('15. Soulbound Accreditation & ERC-5192 Compliance Badges', () => {
        const sbtService = new SoulboundAccreditationService();
        const authorityWallet = ethers.Wallet.createRandom();
        const manufacturerWallet = ethers.Wallet.createRandom();

        it('should issue locked soulbound badge and verify cryptographic signature', async () => {
            const badge = await sbtService.issueAccreditation(authorityWallet, {
                recipient: manufacturerWallet.address,
                accreditationType: AccreditationType.GMP_MANUFACTURING,
                jurisdiction: 'US-FDA',
                validityDays: 365,
                metadataCid: 'bafybeicgmpcert1234567890',
            });

            expect(badge.locked).toBe(true);
            expect(badge.revoked).toBe(false);
            expect(badge.recipient).toBe(manufacturerWallet.address);

            const verification = await sbtService.verifyBadge(badge.tokenId);
            expect(verification.valid).toBe(true);

            const isAccredited = await sbtService.hasValidAccreditation(
                manufacturerWallet.address,
                AccreditationType.GMP_MANUFACTURING,
            );
            expect(isAccredited).toBe(true);
        });

        it('should allow authority to revoke badge and reflect in verification', async () => {
            const badge = await sbtService.issueAccreditation(authorityWallet, {
                recipient: manufacturerWallet.address,
                accreditationType: AccreditationType.COLD_CHAIN_QUALIFIED,
                jurisdiction: 'EU-EMA',
                validityDays: 90,
                metadataCid: 'bafybeiceucoldchaincert',
            });

            const revoked = await sbtService.revokeAccreditation(
                authorityWallet,
                badge.tokenId,
                'Temperature deviation protocol breach',
            );
            expect(revoked.revoked).toBe(true);

            const verification = await sbtService.verifyBadge(badge.tokenId);
            expect(verification.valid).toBe(false);
            expect(verification.reason).toContain('Temperature deviation protocol breach');
        });

        it('should reject revocation from non-issuing authority', async () => {
            const maliciousSigner = ethers.Wallet.createRandom();
            const badge = await sbtService.issueAccreditation(authorityWallet, {
                recipient: manufacturerWallet.address,
                accreditationType: AccreditationType.GDP_DISTRIBUTION,
                jurisdiction: 'WHO-GLOBAL',
                validityDays: 180,
                metadataCid: 'bafybeicwhogdpcert',
            });

            await expect(
                sbtService.revokeAccreditation(maliciousSigner, badge.tokenId, 'Fake revocation'),
            ).rejects.toThrow('Only the issuing regulatory body can revoke this accreditation');
        });
    });
});

