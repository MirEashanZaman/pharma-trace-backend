import { BigInt, Bytes } from '@graphprotocol/graph-ts';

export class DigitalTwin {
  id: string;
  tokenId!: BigInt;
  serialNumber!: string;
  gtin!: string;
  batchNumber!: string;
  currentHolder!: Bytes;
  status!: string;
  isBurned!: boolean;
  dispenser?: Bytes;
  mintedAt!: BigInt;
  burnedAt?: BigInt;
  ipfsDossierCid?: string;

  constructor(id: string) {
    this.id = id;
  }

  save(): void {}

  static load(id: string): DigitalTwin | null {
    return new DigitalTwin(id);
  }
}

export class CustodyTransfer {
  id: string;
  twin!: string;
  from!: Bytes;
  to!: Bytes;
  amount!: BigInt;
  timestamp!: BigInt;
  blockNumber!: BigInt;
  transactionHash!: Bytes;

  constructor(id: string) {
    this.id = id;
  }

  save(): void {}
}

export class EscrowOrder {
  id: string;
  orderId!: Bytes;
  buyer!: Bytes;
  seller!: Bytes;
  amountWei!: BigInt;
  drugSerialNumber!: string;
  status!: string;
  coldChainCompliant!: boolean;
  custodyAccepted!: boolean;
  createdAt!: BigInt;
  settledAt?: BigInt;
  refundReason?: string;
  transactionHash!: Bytes;

  constructor(id: string) {
    this.id = id;
  }

  save(): void {}

  static load(id: string): EscrowOrder | null {
    return new EscrowOrder(id);
  }
}

export class Attestation {
  id: string;
  dataHash!: Bytes;
  drugSerialNumber!: string;
  eventType!: string;
  signer!: Bytes;
  timestamp!: BigInt;
  isRevoked!: boolean;
  revocationReason?: string;
  metadataUri!: string;
  blockNumber!: BigInt;
  transactionHash!: Bytes;

  constructor(id: string) {
    this.id = id;
  }

  save(): void {}

  static load(id: string): Attestation | null {
    return new Attestation(id);
  }
}

export class BatchAnchor {
  id: string;
  merkleRoot!: Bytes;
  batchSize!: number;
  ipfsCid!: string;
  submitter!: Bytes;
  timestamp!: BigInt;
  isRevoked!: boolean;
  blockNumber!: BigInt;
  transactionHash!: Bytes;

  constructor(id: string) {
    this.id = id;
  }

  save(): void {}

  static load(id: string): BatchAnchor | null {
    return new BatchAnchor(id);
  }
}

export class Accreditation {
  id: string;
  tokenId!: Bytes;
  recipient!: Bytes;
  issuer!: Bytes;
  accreditationType!: string;
  jurisdiction!: string;
  validUntil!: BigInt;
  metadataCid!: string;
  isRevoked!: boolean;
  issuedAt!: BigInt;
  blockNumber!: BigInt;
  transactionHash!: Bytes;

  constructor(id: string) {
    this.id = id;
  }

  save(): void {}

  static load(id: string): Accreditation | null {
    return new Accreditation(id);
  }
}
