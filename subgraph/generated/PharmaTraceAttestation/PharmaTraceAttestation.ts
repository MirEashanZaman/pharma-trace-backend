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

  constructor(
    params: {
      dataHash: Bytes;
      drugSerialNumber: string;
      eventType: string;
      signer: Bytes;
      timestamp: BigInt;
      metadataUri: string;
    },
    block: { timestamp: BigInt; number: BigInt },
    transaction: { hash: Bytes },
    logIndex: BigInt,
  ) {
    this.params = params;
    this.block = block;
    this.transaction = transaction;
    this.logIndex = logIndex;
  }
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

  constructor(
    params: {
      dataHash: Bytes;
      revoker: Bytes;
      timestamp: BigInt;
      reason: string;
    },
    block: { timestamp: BigInt; number: BigInt },
    transaction: { hash: Bytes },
    logIndex: BigInt,
  ) {
    this.params = params;
    this.block = block;
    this.transaction = transaction;
    this.logIndex = logIndex;
  }
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

  constructor(
    params: {
      merkleRoot: Bytes;
      batchSize: number;
      ipfsCid: string;
      submitter: Bytes;
      timestamp: BigInt;
    },
    block: { timestamp: BigInt; number: BigInt },
    transaction: { hash: Bytes },
    logIndex: BigInt,
  ) {
    this.params = params;
    this.block = block;
    this.transaction = transaction;
    this.logIndex = logIndex;
  }
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

  constructor(
    params: {
      tokenId: Bytes;
      recipient: Bytes;
      issuer: Bytes;
      accreditationType: string;
      jurisdiction: string;
      validUntil: BigInt;
      metadataCid: string;
    },
    block: { timestamp: BigInt; number: BigInt },
    transaction: { hash: Bytes },
    logIndex: BigInt,
  ) {
    this.params = params;
    this.block = block;
    this.transaction = transaction;
    this.logIndex = logIndex;
  }
}
