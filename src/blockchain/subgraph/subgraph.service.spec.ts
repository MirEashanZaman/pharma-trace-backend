import { Test, TestingModule } from '@nestjs/testing';
import { SubgraphService } from './subgraph.service';

describe('SubgraphService', () => {
  let service: SubgraphService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubgraphService],
    }).compile();

    service = module.get<SubgraphService>(SubgraphService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get and set subgraph endpoint', () => {
    expect(service.getEndpoint()).toContain('subgraph');
    service.setEndpoint('https://api.thegraph.com/subgraphs/name/pharma-trace');
    expect(service.getEndpoint()).toBe('https://api.thegraph.com/subgraphs/name/pharma-trace');
  });

  it('should execute query successfully when graph node responds 200', async () => {
    const mockData = {
      digitalTwins: [
        {
          id: '1',
          tokenId: '1',
          serialNumber: 'SN-100',
          transfers: [],
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: mockData }),
    } as any);

    const result = await service.executeQuery('{ digitalTwins { id } }');
    expect(result).toEqual(mockData);
  });

  it('should fallback gracefully when fetch throws an error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const timeline = await service.getDrugProvenanceTimeline('SN-FALLBACK-01');
    expect(timeline).toBeDefined();
    expect(timeline.digitalTwin).toBeDefined();
    expect(timeline.digitalTwin.serialNumber).toBe('SN-FALLBACK-01');
    expect(timeline.attestations).toBeInstanceOf(Array);
    expect(timeline.transfers).toBeInstanceOf(Array);
  });

  it('should fetch digital twin with custody history', async () => {
    const mockTwin = {
      id: '2',
      tokenId: '2',
      serialNumber: 'SN-TEST-TWIN',
      transfers: [
        {
          id: 'tx-1',
          from: '0x111',
          to: '0x222',
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          digitalTwins: [mockTwin],
        },
      }),
    } as any);

    const res = await service.getDigitalTwinWithCustodyHistory('SN-TEST-TWIN');
    expect(res).toEqual(mockTwin);
    expect(res.transfers.length).toBe(1);
  });

  it('should fetch escrow order with compliance status', async () => {
    const mockEscrow = {
      id: '0xorder123',
      orderId: '0xorder123',
      buyer: '0xBuyer',
      seller: '0xSeller',
      coldChainCompliant: true,
      custodyAccepted: true,
      status: 'RELEASED',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          escrowOrder: mockEscrow,
        },
      }),
    } as any);

    const res = await service.getEscrowOrderWithCompliance('0xorder123');
    expect(res).toEqual(mockEscrow);
    expect(res.coldChainCompliant).toBe(true);
  });

  it('should fetch carrier bonds and accreditations', async () => {
    const mockBonds = [{ id: 'b1', bondAmount: '5000000000000000000' }];
    const mockAccreditations = [{ id: 'a1', accreditationType: 'GDP_LOGISTICS' }];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          carrierBonds: mockBonds,
          accreditations: mockAccreditations,
        },
      }),
    } as any);

    const res = await service.getCarrierBondsAndAccreditations('0xCarrierAddress');
    expect(res.bonds).toEqual(mockBonds);
    expect(res.accreditations).toEqual(mockAccreditations);
  });

  it('should fetch Zk cold-chain verification records', async () => {
    const mockRecords = [
      {
        id: 'zk-1',
        batchHash: '0xbatch123',
        isCompliant: true,
        minTemp: '200',
        maxTemp: '800',
      },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          zkColdChainRecords: mockRecords,
        },
      }),
    } as any);

    const res = await service.getZkColdChainVerificationHistory('0xbatch123');
    expect(res).toEqual(mockRecords);
    expect(res[0].isCompliant).toBe(true);
  });

  it('should fetch cold-chain telemetry excursions', async () => {
    const mockEvents = [
      {
        id: 'ev-1',
        shipmentId: '0xshipment123',
        eventType: 'EXCURSION_DETECTED',
        recordedTemp: '950',
      },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          coldChainTelemetryEvents: mockEvents,
        },
      }),
    } as any);

    const res = await service.getColdChainTelemetryExcursions('0xshipment123');
    expect(res).toEqual(mockEvents);
  });
});
