import { BigInt, Bytes } from '@graphprotocol/graph-ts';

export class PolicyRegistered {
  params: {
    shipmentId: Bytes;
    minTemp: BigInt;
    maxTemp: BigInt;
    maxDuration: BigInt;
  };
  block: { timestamp: BigInt; number: BigInt };
  transaction: { hash: Bytes };
  logIndex: BigInt;

  constructor(
    params: {
      shipmentId: Bytes;
      minTemp: BigInt;
      maxTemp: BigInt;
      maxDuration: BigInt;
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

export class ExcursionDetected {
  params: {
    shipmentId: Bytes;
    recordedTemp: BigInt;
    timestamp: BigInt;
  };
  block: { timestamp: BigInt; number: BigInt };
  transaction: { hash: Bytes };
  logIndex: BigInt;

  constructor(
    params: {
      shipmentId: Bytes;
      recordedTemp: BigInt;
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

export class ExcursionResolved {
  params: {
    shipmentId: Bytes;
    timestamp: BigInt;
  };
  block: { timestamp: BigInt; number: BigInt };
  transaction: { hash: Bytes };
  logIndex: BigInt;

  constructor(
    params: {
      shipmentId: Bytes;
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

export class AutomationSlashTriggered {
  params: {
    shipmentId: Bytes;
    slashPercentage: BigInt;
    reason: string;
  };
  block: { timestamp: BigInt; number: BigInt };
  transaction: { hash: Bytes };
  logIndex: BigInt;

  constructor(
    params: {
      shipmentId: Bytes;
      slashPercentage: BigInt;
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
