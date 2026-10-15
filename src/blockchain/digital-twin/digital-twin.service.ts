import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { keccak256, toUtf8Bytes, getAddress, isAddress } from 'ethers';

export enum DigitalTwinStatus {
  MINTED = 'MINTED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  DISPENSED = 'DISPENSED',
  BURNED = 'BURNED',
}

export interface DigitalTwinRecord {
  tokenId: string;
  gtin: string;
  batchNumber: string;
  serialNumber: string;
  expirationDate: number;
  status: DigitalTwinStatus;
  currentHolder: string;
  ipfsDossierCid: string;
  mintedAt: number;
  burnedAt?: number;
  dispensedBy?: string;
}

export interface MintTwinDto {
  gtin: string;
  batchNumber: string;
  serialNumber: string;
  expirationDate: number;
  holderAddress: string;
  ipfsDossierCid: string;
}

@Injectable()
export class DigitalTwinService {
  private readonly logger = new Logger(DigitalTwinService.name);
  private readonly registry: Map<string, DigitalTwinRecord> = new Map();
  private readonly serialIndex: Map<string, string> = new Map();

  async mintDigitalTwin(dto: MintTwinDto): Promise<DigitalTwinRecord> {
    if (!isAddress(dto.holderAddress)) {
      throw new BadRequestException('Invalid recipient Ethereum address');
    }

    if (this.serialIndex.has(dto.serialNumber)) {
      throw new BadRequestException(`Digital twin for serial ${dto.serialNumber} already exists`);
    }

    const payload = `${dto.gtin}:${dto.batchNumber}:${dto.serialNumber}`;
    const tokenId = keccak256(toUtf8Bytes(payload));

    const record: DigitalTwinRecord = {
      tokenId,
      gtin: dto.gtin,
      batchNumber: dto.batchNumber,
      serialNumber: dto.serialNumber,
      expirationDate: dto.expirationDate,
      status: DigitalTwinStatus.MINTED,
      currentHolder: getAddress(dto.holderAddress),
      ipfsDossierCid: dto.ipfsDossierCid,
      mintedAt: Date.now(),
    };

    this.registry.set(tokenId, record);
    this.serialIndex.set(dto.serialNumber, tokenId);
    this.logger.log(`Minted digital twin ${tokenId} for serial ${dto.serialNumber}`);
    return record;
  }

  async transferCustody(serialNumber: string, fromAddress: string, toAddress: string): Promise<DigitalTwinRecord> {
    const record = await this.getTwinBySerial(serialNumber);

    if (record.status === DigitalTwinStatus.BURNED) {
      throw new BadRequestException('Cannot transfer custody of a burned physical-digital twin');
    }

    const normalizedFrom = getAddress(fromAddress);
    const normalizedTo = getAddress(toAddress);

    if (record.currentHolder !== normalizedFrom) {
      throw new BadRequestException(`Current holder ${record.currentHolder} does not match transfer sender ${normalizedFrom}`);
    }

    record.currentHolder = normalizedTo;
    record.status = DigitalTwinStatus.IN_TRANSIT;
    this.registry.set(record.tokenId, record);
    return record;
  }

  async burnOnDispense(serialNumber: string, dispenserAddress: string): Promise<DigitalTwinRecord> {
    const record = await this.getTwinBySerial(serialNumber);

    if (record.status === DigitalTwinStatus.BURNED) {
      throw new BadRequestException('Anti-recirculation alert: drug unit has already been burned and consumed');
    }

    const normalizedDispenser = getAddress(dispenserAddress);
    if (record.currentHolder !== normalizedDispenser) {
      throw new BadRequestException('Dispenser does not possess valid custody of this digital twin');
    }

    record.status = DigitalTwinStatus.BURNED;
    record.burnedAt = Date.now();
    record.dispensedBy = normalizedDispenser;
    record.currentHolder = '0x0000000000000000000000000000000000000000';

    this.registry.set(record.tokenId, record);
    this.logger.log(`Burned digital twin ${record.tokenId} for serial ${serialNumber} upon patient dispense`);
    return record;
  }

  async verifyAuthenticity(serialNumber: string): Promise<{
    exists: boolean;
    isAuthentic: boolean;
    isBurned: boolean;
    status: DigitalTwinStatus;
    holder: string;
    details?: DigitalTwinRecord;
  }> {
    const tokenId = this.serialIndex.get(serialNumber);
    if (!tokenId || !this.registry.has(tokenId)) {
      return {
        exists: false,
        isAuthentic: false,
        isBurned: false,
        status: DigitalTwinStatus.MINTED,
        holder: '0x0000000000000000000000000000000000000000',
      };
    }

    const record = this.registry.get(tokenId)!;
    const isBurned = record.status === DigitalTwinStatus.BURNED;
    const notExpired = Date.now() < record.expirationDate * 1000;
    const isAuthentic = !isBurned && notExpired;

    return {
      exists: true,
      isAuthentic,
      isBurned,
      status: record.status,
      holder: record.currentHolder,
      details: record,
    };
  }

  async getTwinBySerial(serialNumber: string): Promise<DigitalTwinRecord> {
    const tokenId = this.serialIndex.get(serialNumber);
    if (!tokenId || !this.registry.has(tokenId)) {
      throw new NotFoundException(`Digital twin for serial ${serialNumber} not found`);
    }
    return this.registry.get(tokenId)!;
  }
}
