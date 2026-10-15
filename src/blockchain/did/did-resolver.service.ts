import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { getAddress, isAddress, verifyMessage } from 'ethers';

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  blockchainAccountId: string;
}

export interface W3cDidDocument {
  '@context': string[];
  id: string;
  controller: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  assertionMethod: string[];
  service: {
    id: string;
    type: string;
    serviceEndpoint: string;
  }[];
  regulatoryMetadata: {
    entityName: string;
    gln: string;
    fdaFei: string;
    roles: string[];
    isDscsaAuthorizedTradingPartner: boolean;
  };
}

@Injectable()
export class DidResolverService {
  private readonly logger = new Logger(DidResolverService.name);
  private readonly didDirectory: Map<string, W3cDidDocument> = new Map();

  constructor() {
    this.registerEntity(
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      'BioGenix International Ltd',
      '0844514000001',
      'FEI-3004819201',
      ['MANUFACTURER', 'GMP_CERTIFIED'],
    );
    this.registerEntity(
      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      'Global Reefer Logistics Logistics Corp',
      '0844514000025',
      'FEI-3009182374',
      ['DISTRIBUTOR', 'GDP_CERTIFIED'],
    );
    this.registerEntity(
      '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      'Metropolitan Clinical Pharmacy Care',
      '0844514000056',
      'FEI-3011928341',
      ['DISPENSER', 'GSP_CERTIFIED'],
    );
  }

  registerEntity(
    ethereumAddress: string,
    entityName: string,
    gln: string,
    fdaFei: string,
    roles: string[],
  ): W3cDidDocument {
    if (!isAddress(ethereumAddress)) {
      throw new BadRequestException('Invalid Ethereum address for DID controller');
    }

    const checksumAddress = getAddress(ethereumAddress);
    const did = `did:ethr:${checksumAddress}`;
    const keyId = `${did}#controller`;

    const didDoc: W3cDidDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
      ],
      id: did,
      controller: did,
      verificationMethod: [
        {
          id: keyId,
          type: 'EcdsaSecp256k1RecoveryMethod2020',
          controller: did,
          blockchainAccountId: `eip155:1:${checksumAddress}`,
        },
      ],
      authentication: [keyId],
      assertionMethod: [keyId],
      service: [
        {
          id: `${did}#epcis-repository`,
          type: 'EPCISRepository',
          serviceEndpoint: `https://epcis.pharmatrace.network/v2.0/events?gln=${gln}`,
        },
      ],
      regulatoryMetadata: {
        entityName,
        gln,
        fdaFei,
        roles,
        isDscsaAuthorizedTradingPartner: true,
      },
    };

    this.didDirectory.set(did.toLowerCase(), didDoc);
    this.logger.log(`Registered W3C DID document for ${did} (${entityName}, GLN: ${gln})`);
    return didDoc;
  }

  async resolveDid(did: string): Promise<W3cDidDocument> {
    const doc = this.didDirectory.get(did.toLowerCase());
    if (!doc) {
      throw new NotFoundException(`W3C DID ${did} could not be resolved`);
    }
    return doc;
  }

  async resolveAddress(address: string): Promise<W3cDidDocument> {
    if (!isAddress(address)) {
      throw new BadRequestException('Invalid Ethereum address');
    }
    const did = `did:ethr:${getAddress(address)}`;
    return this.resolveDid(did);
  }

  verifyDidSignature(did: string, message: string, signature: string): boolean {
    const doc = this.didDirectory.get(did.toLowerCase());
    if (!doc) {
      return false;
    }

    try {
      const recovered = verifyMessage(message, signature);
      const expectedAddress = doc.id.replace('did:ethr:', '');
      return recovered.toLowerCase() === expectedAddress.toLowerCase();
    } catch {
      return false;
    }
  }
}
