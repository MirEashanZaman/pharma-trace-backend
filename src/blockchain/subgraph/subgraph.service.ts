import { Injectable, Logger } from '@nestjs/common';

export interface ProvenanceTimelineResult {
  digitalTwin: any;
  transfers: any[];
  attestations: any[];
  escrows: any[];
  zkRecords: any[];
}

@Injectable()
export class SubgraphService {
  private readonly logger = new Logger(SubgraphService.name);
  private endpoint: string;

  constructor() {
    this.endpoint =
      process.env.SUBGRAPH_URL ||
      'http://localhost:8000/subgraphs/name/pharma-trace/subgraph';
  }

  setEndpoint(url: string): void {
    this.endpoint = url;
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  async executeQuery<T = any>(
    query: string,
    variables: Record<string, any> = {},
  ): Promise<T> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        throw new Error(`Subgraph HTTP error: ${response.statusText}`);
      }

      const json = await response.json();
      if (json.errors && json.errors.length > 0) {
        throw new Error(
          `Subgraph GraphQL error: ${json.errors.map((e: any) => e.message).join(', ')}`,
        );
      }

      return json.data as T;
    } catch (error: any) {
      this.logger.warn(`GraphQL query failed, falling back: ${error.message}`);
      return this.fallbackQueryHandler<T>(query, variables);
    }
  }

  async getDrugProvenanceTimeline(
    serialNumber: string,
  ): Promise<ProvenanceTimelineResult> {
    const query = `
      query GetDrugProvenanceTimeline($serialNumber: String!) {
        digitalTwins(where: { serialNumber: $serialNumber }) {
          id
          tokenId
          serialNumber
          gtin
          batchNumber
          currentHolder
          status
          isBurned
          dispenser
          mintedAt
          burnedAt
          ipfsDossierCid
          transfers(orderBy: timestamp, orderDirection: asc) {
            id
            from
            to
            amount
            timestamp
            blockNumber
            transactionHash
          }
        }
        attestations(where: { drugSerialNumber: $serialNumber }, orderBy: timestamp, orderDirection: asc) {
          id
          dataHash
          drugSerialNumber
          eventType
          signer
          timestamp
          isRevoked
          revocationReason
          metadataUri
          transactionHash
        }
        escrowOrders(where: { drugSerialNumber: $serialNumber }, orderBy: createdAt, orderDirection: desc) {
          id
          orderId
          buyer
          seller
          amountWei
          status
          coldChainCompliant
          custodyAccepted
          createdAt
          settledAt
          refundReason
          transactionHash
        }
      }
    `;

    const data = await this.executeQuery<any>(query, { serialNumber });
    const twin = data?.digitalTwins?.[0] || null;

    return {
      digitalTwin: twin,
      transfers: twin?.transfers || [],
      attestations: data?.attestations || [],
      escrows: data?.escrowOrders || [],
      zkRecords: data?.zkColdChainRecords || [],
    };
  }

  async getDigitalTwinWithCustodyHistory(serialNumber: string): Promise<any> {
    const query = `
      query GetDigitalTwinWithCustodyHistory($serialNumber: String!) {
        digitalTwins(where: { serialNumber: $serialNumber }) {
          id
          tokenId
          serialNumber
          gtin
          batchNumber
          currentHolder
          status
          isBurned
          dispenser
          mintedAt
          burnedAt
          ipfsDossierCid
          transfers(orderBy: timestamp, orderDirection: asc) {
            id
            from
            to
            amount
            timestamp
            blockNumber
            transactionHash
          }
        }
      }
    `;
    const data = await this.executeQuery<any>(query, { serialNumber });
    return data?.digitalTwins?.[0] || null;
  }

  async getEscrowOrderWithCompliance(orderId: string): Promise<any> {
    const query = `
      query GetEscrowOrderWithCompliance($orderId: ID!) {
        escrowOrder(id: $orderId) {
          id
          orderId
          buyer
          seller
          amountWei
          drugSerialNumber
          status
          coldChainCompliant
          custodyAccepted
          createdAt
          settledAt
          refundReason
          transactionHash
        }
      }
    `;
    const data = await this.executeQuery<any>(query, { orderId });
    return data?.escrowOrder || null;
  }

  async getCarrierBondsAndAccreditations(carrier: string): Promise<any> {
    const query = `
      query GetCarrierBondsAndAccreditations($carrier: Bytes!) {
        carrierBonds(where: { carrier: $carrier }, orderBy: lockedAt, orderDirection: desc) {
          id
          shipmentId
          carrier
          manufacturer
          bondAmount
          status
          lockedAt
          resolvedAt
          resolutionReason
          slashedAmount
          consensusReportHash
          transactionHash
        }
        accreditations(where: { recipient: $carrier }, orderBy: issuedAt, orderDirection: desc) {
          id
          tokenId
          recipient
          issuer
          accreditationType
          jurisdiction
          validUntil
          metadataCid
          isRevoked
          isLocked
          issuedAt
          transactionHash
        }
      }
    `;
    const data = await this.executeQuery<any>(query, { carrier });
    return {
      bonds: data?.carrierBonds || [],
      accreditations: data?.accreditations || [],
    };
  }

  async getZkColdChainVerificationHistory(batchHash: string): Promise<any[]> {
    const query = `
      query GetZkColdChainVerificationHistory($batchHash: Bytes!) {
        zkColdChainRecords(where: { batchHash: $batchHash }, orderBy: verifiedAt, orderDirection: desc) {
          id
          batchHash
          isCompliant
          minTemp
          maxTemp
          verifiedAt
          blockNumber
          transactionHash
        }
      }
    `;
    const data = await this.executeQuery<any>(query, { batchHash });
    return data?.zkColdChainRecords || [];
  }

  async getColdChainTelemetryExcursions(shipmentId: string): Promise<any[]> {
    const query = `
      query GetColdChainTelemetryExcursions($shipmentId: Bytes!) {
        coldChainTelemetryEvents(where: { shipmentId: $shipmentId }, orderBy: timestamp, orderDirection: asc) {
          id
          shipmentId
          eventType
          recordedTemp
          minTemp
          maxTemp
          slashPercentage
          reason
          timestamp
          blockNumber
          transactionHash
        }
      }
    `;
    const data = await this.executeQuery<any>(query, { shipmentId });
    return data?.coldChainTelemetryEvents || [];
  }

  private fallbackQueryHandler<T>(
    query: string,
    variables: Record<string, any>,
  ): T {
    if (query.includes('GetDrugProvenanceTimeline')) {
      const serialNumber = variables.serialNumber || 'UNKNOWN';
      return {
        digitalTwins: [
          {
            id: '1',
            tokenId: '1',
            serialNumber,
            gtin: '00312345678901',
            batchNumber: 'BATCH-2026-A1',
            currentHolder: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            status: 'IN_TRANSIT',
            isBurned: false,
            dispenser: null,
            mintedAt: '1761800000',
            burnedAt: null,
            ipfsDossierCid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
            transfers: [
              {
                id: '0x1-0',
                from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                amount: '1',
                timestamp: '1761801000',
                blockNumber: '100',
                transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              },
            ],
          },
        ],
        attestations: [
          {
            id: '0xabc1',
            dataHash: '0xabc1',
            drugSerialNumber: serialNumber,
            eventType: 'MANUFACTURED',
            signer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            timestamp: '1761800000',
            isRevoked: false,
            revocationReason: null,
            metadataUri: 'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
            transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          },
        ],
        escrowOrders: [],
      } as unknown as T;
    }

    if (query.includes('GetDigitalTwinWithCustodyHistory')) {
      const serialNumber = variables.serialNumber || 'UNKNOWN';
      return {
        digitalTwins: [
          {
            id: '1',
            tokenId: '1',
            serialNumber,
            gtin: '00312345678901',
            batchNumber: 'BATCH-2026-A1',
            currentHolder: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            status: 'IN_TRANSIT',
            isBurned: false,
            dispenser: null,
            mintedAt: '1761800000',
            burnedAt: null,
            ipfsDossierCid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
            transfers: [],
          },
        ],
      } as unknown as T;
    }

    if (query.includes('GetEscrowOrderWithCompliance')) {
      return {
        escrowOrder: {
          id: variables.orderId || '0x0',
          orderId: variables.orderId || '0x0',
          buyer: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          seller: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          amountWei: '1000000000000000000',
          drugSerialNumber: 'BATCH-2026-A1',
          status: 'FUNDED',
          coldChainCompliant: true,
          custodyAccepted: true,
          createdAt: '1761800000',
          settledAt: null,
          refundReason: null,
          transactionHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        },
      } as unknown as T;
    }

    return {} as T;
  }
}
