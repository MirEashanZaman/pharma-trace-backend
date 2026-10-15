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

  constructor(
    params: {
      orderId: Bytes;
      buyer: Bytes;
      seller: Bytes;
      amountWei: BigInt;
      drugSerialNumber: string;
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

export class ComplianceUpdated {
  params: {
    orderId: Bytes;
    coldChainCompliant: boolean;
    custodyAccepted: boolean;
  };
  block: { timestamp: BigInt; number: BigInt };
  transaction: { hash: Bytes };
  logIndex: BigInt;

  constructor(
    params: {
      orderId: Bytes;
      coldChainCompliant: boolean;
      custodyAccepted: boolean;
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

export class EscrowReleased {
  params: {
    orderId: Bytes;
    seller: Bytes;
    amountWei: BigInt;
  };
  block: { timestamp: BigInt; number: BigInt };
  transaction: { hash: Bytes };
  logIndex: BigInt;

  constructor(
    params: {
      orderId: Bytes;
      seller: Bytes;
      amountWei: BigInt;
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

  constructor(
    params: {
      orderId: Bytes;
      buyer: Bytes;
      amountWei: BigInt;
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
