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
import { EventType } from './events/event-type.enum';
import { UserRole } from './auth/entities/user.entity';

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
                type: 'DRUG_CUSTODY_TRANSFERRED',
                serialNumber: 'SN-2026-AMOX500',
            });

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
});
