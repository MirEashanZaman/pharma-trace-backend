import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ItemMinted,
  BatchTwinMinted,
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
  BatchRevoked,
  AccreditationIssued,
  AccreditationRevoked,
  Locked
} from "../generated/PharmaTraceAttestation/PharmaTraceAttestation";
import {
  BondLocked,
  BondReleased,
  BondSlashed
} from "../generated/CarrierStakingEscrow/CarrierStakingEscrow";
import {
  ProofVerified
} from "../generated/ZkColdChainVerifier/ZkColdChainVerifier";
import {
  PolicyRegistered,
  ExcursionDetected,
  ExcursionResolved,
  AutomationSlashTriggered
} from "../generated/ColdChainAutomationOracle/ColdChainAutomationOracle";
import {
  DigitalTwin,
  BatchTwin,
  CustodyTransfer,
  EscrowOrder,
  Attestation,
  BatchAnchor,
  Accreditation,
  CarrierBond,
  ZkColdChainRecord,
  ColdChainTelemetryEvent
} from "../generated/schema";

function sanitizeString(value: string, maxLen: number): string {
  let len = value.length;
  if (len > maxLen) {
    len = maxLen;
  }
  let out = "";
  for (let i = 0; i < len; i++) {
    let c = value.charCodeAt(i);
    if (c == 0 || (c < 32 && c != 9 && c != 10 && c != 13)) {
      continue;
    }
    if (c == 60) {
      out = out.concat("&lt;");
    } else if (c == 62) {
      out = out.concat("&gt;");
    } else if (c == 34) {
      out = out.concat("&quot;");
    } else if (c == 39) {
      out = out.concat("&#x27;");
    } else {
      out = out.concat(value.charAt(i));
    }
  }
  return out;
}

export function handleItemMinted(event: ItemMinted): void {
  let id = event.params.tokenId.toHexString();
  let twin = new DigitalTwin(id);
  twin.tokenId = event.params.tokenId;
  twin.serialNumber = sanitizeString(event.params.serialNumber, 128);
  twin.gtin = sanitizeString(event.params.gtin, 64);
  twin.batchNumber = sanitizeString(event.params.batchNumber, 64);
  twin.currentHolder = event.params.manufacturer;
  twin.status = "MINTED";
  twin.isBurned = false;
  twin.mintedAt = event.block.timestamp;
  twin.save();
}

export function handleBatchTwinMinted(event: BatchTwinMinted): void {
  let id = event.params.batchTokenId.toHexString();
  let batch = new BatchTwin(id);
  batch.batchTokenId = event.params.batchTokenId;
  batch.batchNumber = sanitizeString(event.params.batchNumber, 64);
  batch.manufacturer = event.params.manufacturer;
  batch.totalUnits = event.params.totalUnits;
  batch.mintedAt = event.block.timestamp;
  batch.blockNumber = event.block.number;
  batch.transactionHash = event.transaction.hash;
  batch.save();
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
  escrow.drugSerialNumber = sanitizeString(event.params.drugSerialNumber, 128);
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
    escrow.refundReason = sanitizeString(event.params.reason, 256);
    escrow.settledAt = event.block.timestamp;
    escrow.save();
  }
}

export function handleAttestationRegistered(event: AttestationRegistered): void {
  let id = event.params.dataHash.toHexString();
  let attestation = new Attestation(id);
  attestation.dataHash = event.params.dataHash;
  attestation.drugSerialNumber = sanitizeString(event.params.drugSerialNumber, 128);
  attestation.eventType = sanitizeString(event.params.eventType, 64);
  attestation.signer = event.params.signer;
  attestation.timestamp = event.params.timestamp;
  attestation.isRevoked = false;
  attestation.metadataUri = sanitizeString(event.params.metadataUri, 512);
  attestation.blockNumber = event.block.number;
  attestation.transactionHash = event.transaction.hash;
  attestation.save();
}

export function handleAttestationRevoked(event: AttestationRevoked): void {
  let id = event.params.dataHash.toHexString();
  let attestation = Attestation.load(id);
  if (attestation) {
    attestation.isRevoked = true;
    attestation.revocationReason = sanitizeString(event.params.reason, 256);
    attestation.save();
  }
}

export function handleBatchAnchored(event: BatchAnchored): void {
  let id = event.params.merkleRoot.toHexString();
  let batch = new BatchAnchor(id);
  batch.merkleRoot = event.params.merkleRoot;
  batch.batchSize = event.params.batchSize;
  batch.ipfsCid = sanitizeString(event.params.ipfsCid, 128);
  batch.submitter = event.params.submitter;
  batch.timestamp = event.params.timestamp;
  batch.isRevoked = false;
  batch.blockNumber = event.block.number;
  batch.transactionHash = event.transaction.hash;
  batch.save();
}

export function handleBatchRevoked(event: BatchRevoked): void {
  let id = event.params.merkleRoot.toHexString();
  let batch = BatchAnchor.load(id);
  if (batch) {
    batch.isRevoked = true;
    batch.revocationReason = sanitizeString(event.params.reason, 256);
    batch.save();
  }
}

export function handleAccreditationIssued(event: AccreditationIssued): void {
  let id = event.params.tokenId.toHexString();
  let acc = new Accreditation(id);
  acc.tokenId = event.params.tokenId;
  acc.recipient = event.params.recipient;
  acc.issuer = event.params.issuer;
  acc.accreditationType = sanitizeString(event.params.accreditationType, 64);
  acc.jurisdiction = sanitizeString(event.params.jurisdiction, 64);
  acc.validUntil = event.params.validUntil;
  acc.metadataCid = sanitizeString(event.params.metadataCid, 128);
  acc.isRevoked = false;
  acc.isLocked = true;
  acc.issuedAt = event.block.timestamp;
  acc.blockNumber = event.block.number;
  acc.transactionHash = event.transaction.hash;
  acc.save();
}

export function handleAccreditationRevoked(event: AccreditationRevoked): void {
  let id = event.params.tokenId.toHexString();
  let acc = Accreditation.load(id);
  if (acc) {
    acc.isRevoked = true;
    acc.revocationReason = sanitizeString(event.params.reason, 256);
    acc.save();
  }
}

export function handleAccreditationLocked(event: Locked): void {
  let id = event.params.tokenId.toHexString();
  let acc = Accreditation.load(id);
  if (acc) {
    acc.isLocked = true;
    acc.save();
  }
}

export function handleBondLocked(event: BondLocked): void {
  let id = event.params.shipmentId.toHexString();
  let bond = new CarrierBond(id);
  bond.shipmentId = event.params.shipmentId;
  bond.carrier = event.params.carrier;
  bond.manufacturer = event.params.manufacturer;
  bond.bondAmount = event.params.bondAmount;
  bond.status = "LOCKED";
  bond.lockedAt = event.block.timestamp;
  bond.blockNumber = event.block.number;
  bond.transactionHash = event.transaction.hash;
  bond.save();
}

export function handleBondReleased(event: BondReleased): void {
  let id = event.params.shipmentId.toHexString();
  let bond = CarrierBond.load(id);
  if (bond) {
    bond.status = "RELEASED";
    bond.resolvedAt = event.block.timestamp;
    bond.resolutionReason = "RELEASED_UPON_SAFE_DELIVERY";
    bond.save();
  }
}

export function handleBondSlashed(event: BondSlashed): void {
  let id = event.params.shipmentId.toHexString();
  let bond = CarrierBond.load(id);
  if (bond) {
    bond.status = "SLASHED";
    bond.slashedAmount = event.params.slashedAmount;
    bond.resolutionReason = sanitizeString(event.params.excursionReason, 256);
    bond.consensusReportHash = event.params.consensusReportHash;
    bond.resolvedAt = event.block.timestamp;
    bond.save();
  }
}

export function handleProofVerified(event: ProofVerified): void {
  let id = event.params.batchHash.toHexString() + "-" + event.logIndex.toString();
  let zk = new ZkColdChainRecord(id);
  zk.batchHash = event.params.batchHash;
  zk.isCompliant = event.params.isCompliant;
  zk.minTemp = event.params.minTemp;
  zk.maxTemp = event.params.maxTemp;
  zk.verifiedAt = event.params.verifiedAt;
  zk.blockNumber = event.block.number;
  zk.transactionHash = event.transaction.hash;
  zk.save();
}

export function handlePolicyRegistered(event: PolicyRegistered): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let telemetry = new ColdChainTelemetryEvent(id);
  telemetry.shipmentId = event.params.shipmentId;
  telemetry.eventType = "POLICY_REGISTERED";
  telemetry.minTemp = event.params.minTemp;
  telemetry.maxTemp = event.params.maxTemp;
  telemetry.timestamp = event.block.timestamp;
  telemetry.blockNumber = event.block.number;
  telemetry.transactionHash = event.transaction.hash;
  telemetry.save();
}

export function handleExcursionDetected(event: ExcursionDetected): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let telemetry = new ColdChainTelemetryEvent(id);
  telemetry.shipmentId = event.params.shipmentId;
  telemetry.eventType = "EXCURSION_DETECTED";
  telemetry.recordedTemp = event.params.recordedTemp;
  telemetry.timestamp = event.params.timestamp;
  telemetry.blockNumber = event.block.number;
  telemetry.transactionHash = event.transaction.hash;
  telemetry.save();
}

export function handleExcursionResolved(event: ExcursionResolved): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let telemetry = new ColdChainTelemetryEvent(id);
  telemetry.shipmentId = event.params.shipmentId;
  telemetry.eventType = "EXCURSION_RESOLVED";
  telemetry.timestamp = event.params.timestamp;
  telemetry.blockNumber = event.block.number;
  telemetry.transactionHash = event.transaction.hash;
  telemetry.save();
}

export function handleAutomationSlashTriggered(event: AutomationSlashTriggered): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let telemetry = new ColdChainTelemetryEvent(id);
  telemetry.shipmentId = event.params.shipmentId;
  telemetry.eventType = "SLASH_TRIGGERED";
  telemetry.slashPercentage = event.params.slashPercentage;
  telemetry.reason = sanitizeString(event.params.reason, 256);
  telemetry.timestamp = event.block.timestamp;
  telemetry.blockNumber = event.block.number;
  telemetry.transactionHash = event.transaction.hash;
  telemetry.save();
}
