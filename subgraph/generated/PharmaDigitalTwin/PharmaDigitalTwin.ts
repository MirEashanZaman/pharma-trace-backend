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

  constructor(
    params: {
      tokenId: BigInt;
      serialNumber: string;
      manufacturer: Bytes;
      gtin: string;
      batchNumber: string;
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

  constructor(
    params: {
      tokenId: BigInt;
      from: Bytes;
      to: Bytes;
      amount: BigInt;
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

  constructor(
    params: {
      tokenId: BigInt;
      serialNumber: string;
      dispenser: Bytes;
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
