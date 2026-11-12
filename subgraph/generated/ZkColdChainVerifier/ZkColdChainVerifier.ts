import { BigInt, Bytes } from '@graphprotocol/graph-ts';

export class ProofVerified {
  params: {
    batchHash: Bytes;
    isCompliant: boolean;
    minTemp: BigInt;
    maxTemp: BigInt;
    verifiedAt: BigInt;
  };
  block: { timestamp: BigInt; number: BigInt };
  transaction: { hash: Bytes };
  logIndex: BigInt;

  constructor(
    params: {
      batchHash: Bytes;
      isCompliant: boolean;
      minTemp: BigInt;
      maxTemp: BigInt;
      verifiedAt: BigInt;
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
