import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ItemMinted,
  CustodyTransferred,
  ItemBurnedOnDispense
} from "../generated/PharmaDigitalTwin/PharmaDigitalTwin";
import {
  EscrowFunded,
  ComplianceUpdated,
  EscrowReleased,
  EscrowRefunded
} from "../generated/PharmaEscrowEngine/PharmaEscrowEngine";
import {
  AttestationRegistered,
  AttestationRevoked,
  BatchAnchored,
  AccreditationIssued
} from "../generated/PharmaTraceAttestation/PharmaTraceAttestation";
import {
  DigitalTwin,
  CustodyTransfer,
  EscrowOrder,
  Attestation,
  BatchAnchor,
  Accreditation
} from "../generated/schema";

export function handleItemMinted(event: ItemMinted): void {
  let id = event.params.tokenId.toHexString();
  let twin = new DigitalTwin(id);
  twin.tokenId = event.params.tokenId;
  twin.serialNumber = event.params.serialNumber;
  twin.gtin = event.params.gtin;
  twin.batchNumber = event.params.batchNumber;
  twin.currentHolder = event.params.manufacturer;
  twin.status = "MINTED";
  twin.isBurned = false;
  twin.mintedAt = event.block.timestamp;
  twin.save();
}

export function handleCustodyTransferred(event: CustodyTransferred): void {
  let twinId = event.params.tokenId.toHexString();
  let twin = DigitalTwin.load(twinId);
  if (twin) {
    twin.currentHolder = event.params.to;
    twin.status = "IN_TRANSIT";
    twin.save();
  }

  let transferId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let transfer = new CustodyTransfer(transferId);
  transfer.twin = twinId;
  transfer.from = event.params.from;
  transfer.to = event.params.to;
  transfer.amount = event.params.amount;
  transfer.timestamp = event.block.timestamp;
  transfer.blockNumber = event.block.number;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();
}

export function handleItemBurnedOnDispense(event: ItemBurnedOnDispense): void {
  let id = event.params.tokenId.toHexString();
  let twin = DigitalTwin.load(id);
  if (twin) {
    twin.isBurned = true;
    twin.status = "BURNED";
    twin.burnedAt = event.params.timestamp;
    twin.dispenser = event.params.dispenser;
    twin.currentHolder = Bytes.fromHexString("0x0000000000000000000000000000000000000000");
    twin.save();
  }
}

export function handleEscrowFunded(event: EscrowFunded): void {
  let orderId = event.params.orderId.toHexString();
  let escrow = new EscrowOrder(orderId);
  escrow.orderId = event.params.orderId;
  escrow.buyer = event.params.buyer;
  escrow.seller = event.params.seller;
  escrow.amountWei = event.params.amountWei;
  escrow.drugSerialNumber = event.params.drugSerialNumber;
  escrow.status = "FUNDED";
  escrow.coldChainCompliant = false;
  escrow.custodyAccepted = false;
  escrow.createdAt = event.block.timestamp;
  escrow.transactionHash = event.transaction.hash;
  escrow.save();
}

export function handleComplianceUpdated(event: ComplianceUpdated): void {
  let orderId = event.params.orderId.toHexString();
  let escrow = EscrowOrder.load(orderId);
  if (escrow) {
    escrow.coldChainCompliant = event.params.coldChainCompliant;
    escrow.custodyAccepted = event.params.custodyAccepted;
    escrow.save();
  }
}

export function handleEscrowReleased(event: EscrowReleased): void {
  let orderId = event.params.orderId.toHexString();
  let escrow = EscrowOrder.load(orderId);
  if (escrow) {
    escrow.status = "RELEASED";
    escrow.settledAt = event.block.timestamp;
    escrow.save();
  }
}

export function handleEscrowRefunded(event: EscrowRefunded): void {
  let orderId = event.params.orderId.toHexString();
  let escrow = EscrowOrder.load(orderId);
  if (escrow) {
    escrow.status = "REFUNDED";
    escrow.refundReason = event.params.reason;
    escrow.settledAt = event.block.timestamp;
    escrow.save();
  }
}

export function handleAttestationRegistered(event: AttestationRegistered): void {
  let id = event.params.dataHash.toHexString();
  let attestation = new Attestation(id);
  attestation.dataHash = event.params.dataHash;
  attestation.drugSerialNumber = event.params.drugSerialNumber;
  attestation.eventType = event.params.eventType;
  attestation.signer = event.params.signer;
  attestation.timestamp = event.params.timestamp;
  attestation.isRevoked = false;
  attestation.metadataUri = event.params.metadataUri;
  attestation.blockNumber = event.block.number;
  attestation.transactionHash = event.transaction.hash;
  attestation.save();
}

export function handleAttestationRevoked(event: AttestationRevoked): void {
  let id = event.params.dataHash.toHexString();
  let attestation = Attestation.load(id);
  if (attestation) {
    attestation.isRevoked = true;
    attestation.revocationReason = event.params.reason;
    attestation.save();
  }
}

export function handleBatchAnchored(event: BatchAnchored): void {
  let id = event.params.merkleRoot.toHexString();
  let batch = new BatchAnchor(id);
  batch.merkleRoot = event.params.merkleRoot;
  batch.batchSize = event.params.batchSize;
  batch.ipfsCid = event.params.ipfsCid;
  batch.submitter = event.params.submitter;
  batch.timestamp = event.params.timestamp;
  batch.isRevoked = false;
  batch.blockNumber = event.block.number;
  batch.transactionHash = event.transaction.hash;
  batch.save();
}

export function handleAccreditationIssued(event: AccreditationIssued): void {
  let id = event.params.tokenId.toHexString();
  let acc = new Accreditation(id);
  acc.tokenId = event.params.tokenId;
  acc.recipient = event.params.recipient;
  acc.issuer = event.params.issuer;
  acc.accreditationType = event.params.accreditationType;
  acc.jurisdiction = event.params.jurisdiction;
  acc.validUntil = event.params.validUntil;
  acc.metadataCid = event.params.metadataCid;
  acc.isRevoked = false;
  acc.issuedAt = event.block.timestamp;
  acc.blockNumber = event.block.number;
  acc.transactionHash = event.transaction.hash;
  acc.save();
}
