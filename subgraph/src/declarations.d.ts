declare module '@graphprotocol/graph-ts' {
  export class BigInt {
    static fromI32(value: number): BigInt;
    toHexString(): string;
    toString(): string;
  }
  export class Bytes {
    static fromHexString(value: string): Bytes;
    toHexString(): string;
  }
}

declare module '../generated/PharmaDigitalTwin/PharmaDigitalTwin' {
  import { BigInt, Bytes } from '@graphprotocol/graph-ts';
  export class ItemMinted {
    params: {
      tokenId: BigInt;
      serialNumber: string;
      manufacturer: Bytes;
      gtin: string;
      batchNumber: string;
    };
    block: { timestamp: BigInt; number: BigInt };
    transaction: { hash: Bytes };
    logIndex: BigInt;
  }
  export class CustodyTransferred {
    params: {
      tokenId: BigInt;
      from: Bytes;
      to: Bytes;
      amount: BigInt;
    };
    block: { timestamp: BigInt; number: BigInt };
    transaction: { hash: Bytes };
    logIndex: BigInt;
  }
  export class ItemBurnedOnDispense {
    params: {
      tokenId: BigInt;
      serialNumber: string;
      dispenser: Bytes;
      timestamp: BigInt;
    };
    block: { timestamp: BigInt; number: BigInt };
    transaction: { hash: Bytes };
    logIndex: BigInt;
  }
}

declare module '../generated/PharmaEscrowEngine/PharmaEscrowEngine' {
  import { BigInt, Bytes } from '@graphprotocol/graph-ts';
  export class EscrowFunded {
    params: {
      orderId: Bytes;
      buyer: Bytes;
      seller: Bytes;
      amountWei: BigInt;
      drugSerialNumber: string;
    };
    block: { timestamp: BigInt; number: BigInt };
    transaction: { hash: Bytes };
    logIndex: BigInt;
  }
  export class ComplianceUpdated {
    params: {
      orderId: Bytes;
      coldChainCompliant: boolean;
      custodyAccepted: boolean;
    };
    block: { timestamp: BigInt; number: BigInt };
    transaction: { hash: Bytes };
    logIndex: BigInt;
  }
  export class EscrowReleased {
    params: {
      orderId: Bytes;
      seller: Bytes;
      amountWei: BigInt;
    };
    block: { timestamp: BigInt; number: BigInt };
    transaction: { hash: Bytes };
    logIndex: BigInt;
  }
  export class EscrowRefunded {
    params: {
      orderId: Bytes;
      buyer: Bytes;
      amountWei: BigInt;
      reason: string;
    };
    block: { timestamp: BigInt; number: BigInt };
    transaction: { hash: Bytes };
    logIndex: BigInt;
  }
}

declare module '../generated/PharmaTraceAttestation/PharmaTraceAttestation' {
  import { BigInt, Bytes } from '@graphprotocol/graph-ts';
  export class AttestationRegistered {
    params: {
      dataHash: Bytes;
      drugSerialNumber: string;
      eventType: string;
      signer: Bytes;
      timestamp: BigInt;
      metadataUri: string;
    };
    block: { timestamp: BigInt; number: BigInt };
    transaction: { hash: Bytes };
    logIndex: BigInt;
  }
  export class AttestationRevoked {
    params: {
      dataHash: Bytes;
      revoker: Bytes;
      timestamp: BigInt;
      reason: string;
    };
    block: { timestamp: BigInt; number: BigInt };
    transaction: { hash: Bytes };
    logIndex: BigInt;
  }
  export class BatchAnchored {
    params: {
      merkleRoot: Bytes;
      batchSize: number;
      ipfsCid: string;
      submitter: Bytes;
      timestamp: BigInt;
    };
    block: { timestamp: BigInt; number: BigInt };
    transaction: { hash: Bytes };
    logIndex: BigInt;
  }
  export class AccreditationIssued {
    params: {
      tokenId: Bytes;
      recipient: Bytes;
      issuer: Bytes;
      accreditationType: string;
      jurisdiction: string;
      validUntil: BigInt;
      metadataCid: string;
    };
    block: { timestamp: BigInt; number: BigInt };
    transaction: { hash: Bytes };
    logIndex: BigInt;
  }
}

declare module '../generated/schema' {
  import { BigInt, Bytes } from '@graphprotocol/graph-ts';
  export class DigitalTwin {
    constructor(id: string);
    id: string;
    tokenId: BigInt;
    serialNumber: string;
    gtin: string;
    batchNumber: string;
    currentHolder: Bytes;
    status: string;
    isBurned: boolean;
    dispenser: Bytes;
    mintedAt: BigInt;
    burnedAt: BigInt;
    ipfsDossierCid: string;
    save(): void;
    static load(id: string): DigitalTwin | null;
  }
  export class CustodyTransfer {
    constructor(id: string);
    id: string;
    twin: string;
    from: Bytes;
    to: Bytes;
    amount: BigInt;
    timestamp: BigInt;
    blockNumber: BigInt;
    transactionHash: Bytes;
    save(): void;
  }
  export class EscrowOrder {
    constructor(id: string);
    id: string;
    orderId: Bytes;
    buyer: Bytes;
    seller: Bytes;
    amountWei: BigInt;
    drugSerialNumber: string;
    status: string;
    coldChainCompliant: boolean;
    custodyAccepted: boolean;
    createdAt: BigInt;
    settledAt: BigInt;
    refundReason: string;
    transactionHash: Bytes;
    save(): void;
    static load(id: string): EscrowOrder | null;
  }
  export class Attestation {
    constructor(id: string);
    id: string;
    dataHash: Bytes;
    drugSerialNumber: string;
    eventType: string;
    signer: Bytes;
    timestamp: BigInt;
    isRevoked: boolean;
    revocationReason: string;
    metadataUri: string;
    blockNumber: BigInt;
    transactionHash: Bytes;
    save(): void;
    static load(id: string): Attestation | null;
  }
  export class BatchAnchor {
    constructor(id: string);
    id: string;
    merkleRoot: Bytes;
    batchSize: number;
    ipfsCid: string;
    submitter: Bytes;
    timestamp: BigInt;
    isRevoked: boolean;
    blockNumber: BigInt;
    transactionHash: Bytes;
    save(): void;
    static load(id: string): BatchAnchor | null;
  }
  export class Accreditation {
    constructor(id: string);
    id: string;
    tokenId: Bytes;
    recipient: Bytes;
    issuer: Bytes;
    accreditationType: string;
    jurisdiction: string;
    validUntil: BigInt;
    metadataCid: string;
    isRevoked: boolean;
    issuedAt: BigInt;
    blockNumber: BigInt;
    transactionHash: Bytes;
    save(): void;
    static load(id: string): Accreditation | null;
  }
}
