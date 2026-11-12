import { BigInt, Bytes } from '@graphprotocol/graph-ts';

export class BondLocked {
  params: {
    shipmentId: Bytes;
    carrier: Bytes;
    manufacturer: Bytes;
    bondAmount: BigInt;
  };
  block: { timestamp: BigInt; number: BigInt };
  transaction: { hash: Bytes };
  logIndex: BigInt;

  constructor(
    params: {
      shipmentId: Bytes;
      carrier: Bytes;
      manufacturer: Bytes;
      bondAmount: BigInt;
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

export class BondReleased {
  params: {
    shipmentId: Bytes;
    carrier: Bytes;
    bondAmount: BigInt;
  };
  block: { timestamp: BigInt; number: BigInt };
  transaction: { hash: Bytes };
  logIndex: BigInt;

  constructor(
    params: {
      shipmentId: Bytes;
      carrier: Bytes;
      bondAmount: BigInt;
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

export class BondSlashed {
  params: {
    shipmentId: Bytes;
    carrier: Bytes;
    manufacturer: Bytes;
    slashedAmount: BigInt;
    excursionReason: string;
    consensusReportHash: Bytes;
  };
  block: { timestamp: BigInt; number: BigInt };
  transaction: { hash: Bytes };
  logIndex: BigInt;

  constructor(
    params: {
      shipmentId: Bytes;
      carrier: Bytes;
      manufacturer: Bytes;
      slashedAmount: BigInt;
      excursionReason: string;
      consensusReportHash: Bytes;
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
