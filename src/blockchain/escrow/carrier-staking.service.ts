import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { isAddress, getAddress, keccak256, toUtf8Bytes } from 'ethers';
import {
  SensorConsensusEngine,
  CheckpointCluster,
} from '../../iot/consensus/sensor-consensus.engine';
import {
  CarrierStakeAccount,
  ShipmentBond,
  CarrierBondResolution,
  DepositStakeDto,
  LockBondDto,
  UnstakeDto,
} from './carrier-staking.types';

@Injectable()
export class CarrierStakingService {
  private readonly logger = new Logger(CarrierStakingService.name);
  private readonly accounts: Map<string, CarrierStakeAccount> = new Map();
  private readonly bonds: Map<string, ShipmentBond> = new Map();
  private readonly indemnityLedger: Map<string, number> = new Map();

  constructor(
    private readonly consensusEngine: SensorConsensusEngine = new SensorConsensusEngine(),
  ) {}

  depositStake(dto: DepositStakeDto): CarrierStakeAccount {
    if (!isAddress(dto.carrierAddress)) {
      throw new BadRequestException(`Invalid carrier Ethereum address: ${dto.carrierAddress}`);
    }
    if (dto.amountTokens <= 0) {
      throw new BadRequestException('Stake deposit amount must be greater than zero');
    }

    const carrier = getAddress(dto.carrierAddress);
    const symbol = dto.tokenSymbol || 'USDC';
    const existing = this.accounts.get(carrier) || {
      carrierAddress: carrier,
      totalStaked: 0,
      lockedCollateral: 0,
      availableCollateral: 0,
      totalSlashed: 0,
      totalIndemnified: 0,
      isAccredited: false,
      tokenSymbol: symbol,
      lastUpdated: Date.now(),
    };

    existing.totalStaked += dto.amountTokens;
    existing.availableCollateral = existing.totalStaked - existing.lockedCollateral;
    existing.isAccredited = true;
    existing.lastUpdated = Date.now();

    this.accounts.set(carrier, existing);
    this.logger.log(`Carrier ${carrier} deposited ${dto.amountTokens} ${symbol} collateral stake (Total: ${existing.totalStaked})`);
    return existing;
  }

  getAccount(carrierAddress: string): CarrierStakeAccount {
    if (!isAddress(carrierAddress)) {
      throw new BadRequestException(`Invalid carrier address: ${carrierAddress}`);
    }
    const carrier = getAddress(carrierAddress);
    const account = this.accounts.get(carrier);
    if (!account) {
      throw new NotFoundException(`No staking account found for carrier ${carrier}`);
    }
    account.availableCollateral = account.totalStaked - account.lockedCollateral;
    return account;
  }

  lockShipmentBond(dto: LockBondDto): ShipmentBond {
    if (!isAddress(dto.carrierAddress) || !isAddress(dto.manufacturerAddress)) {
      throw new BadRequestException('Carrier and manufacturer must be valid Ethereum addresses');
    }
    if (dto.bondAmount <= 0) {
      throw new BadRequestException('Bond amount must be greater than zero');
    }

    const carrier = getAddress(dto.carrierAddress);
    const manufacturer = getAddress(dto.manufacturerAddress);
    const account = this.getAccount(carrier);

    if (!account.isAccredited) {
      throw new BadRequestException(`Carrier ${carrier} is not accredited for cold-chain shipments`);
    }

    if (account.availableCollateral < dto.bondAmount) {
      throw new BadRequestException(
        `Insufficient available collateral. Required: ${dto.bondAmount}, Available: ${account.availableCollateral}`,
      );
    }

    if (this.bonds.has(dto.shipmentId)) {
      throw new BadRequestException(`Bond already exists for shipment ${dto.shipmentId}`);
    }

    account.lockedCollateral += dto.bondAmount;
    account.availableCollateral = account.totalStaked - account.lockedCollateral;
    account.lastUpdated = Date.now();

    const bond: ShipmentBond = {
      shipmentId: dto.shipmentId,
      carrierAddress: carrier,
      manufacturerAddress: manufacturer,
      drugSerialNumber: dto.drugSerialNumber,
      bondAmount: dto.bondAmount,
      status: 'LOCKED',
      minTemp: dto.minTemp ?? 2.0,
      maxTemp: dto.maxTemp ?? 8.0,
      lockedAt: Date.now(),
    };

    this.bonds.set(dto.shipmentId, bond);
    this.logger.log(`Locked ${dto.bondAmount} collateral bond for carrier ${carrier} on shipment ${dto.shipmentId}`);
    return bond;
  }

  getBond(shipmentId: string): ShipmentBond {
    const bond = this.bonds.get(shipmentId);
    if (!bond) {
      throw new NotFoundException(`No shipment bond found for id ${shipmentId}`);
    }
    return bond;
  }

  listBonds(query?: { carrierAddress?: string; status?: string; limit?: number }): ShipmentBond[] {
    let result = Array.from(this.bonds.values());
    if (query?.carrierAddress && isAddress(query.carrierAddress)) {
      const normalized = getAddress(query.carrierAddress);
      result = result.filter((b) => b.carrierAddress === normalized);
    }
    if (query?.status) {
      result = result.filter((b) => b.status === query.status);
    }
    if (query?.limit) {
      result = result.slice(0, Number(query.limit));
    }
    return result;
  }

  cancelBond(shipmentId: string, reason: string = 'Shipment cancelled prior to departure'): ShipmentBond {
    const bond = this.getBond(shipmentId);
    if (bond.status !== 'LOCKED') {
      throw new BadRequestException(`Cannot cancel bond with status ${bond.status}`);
    }
    const carrier = this.getAccount(bond.carrierAddress);
    carrier.lockedCollateral -= bond.bondAmount;
    carrier.availableCollateral = carrier.totalStaked - carrier.lockedCollateral;
    carrier.lastUpdated = Date.now();

    bond.status = 'CANCELLED' as any;
    bond.resolvedAt = Date.now();
    bond.resolutionReason = reason;
    return bond;
  }

  evaluateAndResolveBond(
    shipmentId: string,
    sensorClusters: CheckpointCluster[],
    slashPercentage: number = 100,
  ): CarrierBondResolution {
    const bond = this.getBond(shipmentId);
    if (bond.status !== 'LOCKED') {
      throw new BadRequestException(`Bond ${shipmentId} is already resolved with status ${bond.status}`);
    }

    const carrier = this.getAccount(bond.carrierAddress);
    const consensusReport = this.consensusEngine.evaluateTransitSeries(
      shipmentId,
      sensorClusters,
      bond.minTemp,
      bond.maxTemp,
    );

    const medianTemp = consensusReport.overallMedianTemperature;
    const reportHash = keccak256(toUtf8Bytes(JSON.stringify(consensusReport)));

    if (consensusReport.isSettlementApproved) {
      carrier.lockedCollateral -= bond.bondAmount;
      carrier.availableCollateral = carrier.totalStaked - carrier.lockedCollateral;
      carrier.lastUpdated = Date.now();

      bond.status = 'RELEASED';
      bond.slashedAmount = 0;
      bond.resolvedAt = Date.now();
      bond.resolutionReason = 'Multi-sensor consensus verified compliant cold-chain handover';
      bond.consensusReportHash = reportHash;

      this.logger.log(`Released ${bond.bondAmount} bond for carrier ${bond.carrierAddress} on shipment ${shipmentId}`);

      return {
        shipmentId,
        status: 'RELEASED',
        bondAmount: bond.bondAmount,
        slashedAmount: 0,
        reason: bond.resolutionReason,
        isolatedFaultsCount: consensusReport.isolatedSensorFaults,
        clusterMedianTemp: medianTemp,
        consensusReportHash: reportHash,
      };
    }

    const slashPct = Math.min(Math.max(1, slashPercentage), 100);
    const slashedAmount = (bond.bondAmount * slashPct) / 100;

    carrier.lockedCollateral -= bond.bondAmount;
    carrier.totalStaked -= slashedAmount;
    carrier.availableCollateral = carrier.totalStaked - carrier.lockedCollateral;
    carrier.totalSlashed += slashedAmount;
    carrier.totalIndemnified += slashedAmount;
    carrier.lastUpdated = Date.now();

    const currentIndemnity = this.indemnityLedger.get(bond.manufacturerAddress) || 0;
    this.indemnityLedger.set(bond.manufacturerAddress, currentIndemnity + slashedAmount);

    const reason = `Autonomous bond slashing: multi-sensor consensus rejected cold-chain telemetry. Excursions: ${consensusReport.excursionCheckpoints}`;

    bond.status = 'SLASHED';
    bond.slashedAmount = slashedAmount;
    bond.resolvedAt = Date.now();
    bond.resolutionReason = reason;
    bond.consensusReportHash = reportHash;

    this.logger.warn(
      `Slashed ${slashedAmount} from carrier ${bond.carrierAddress}. Indemnified manufacturer ${bond.manufacturerAddress} for shipment ${shipmentId}`,
    );

    return {
      shipmentId,
      status: 'SLASHED',
      bondAmount: bond.bondAmount,
      slashedAmount,
      indemnityRecipient: bond.manufacturerAddress,
      reason,
      isolatedFaultsCount: consensusReport.isolatedSensorFaults,
      clusterMedianTemp: medianTemp,
      consensusReportHash: reportHash,
    };
  }

  unstake(dto: UnstakeDto): CarrierStakeAccount {
    if (dto.amountTokens <= 0) {
      throw new BadRequestException('Unstake amount must be greater than zero');
    }
    const carrier = this.getAccount(dto.carrierAddress);
    if (carrier.availableCollateral < dto.amountTokens) {
      throw new BadRequestException(
        `Cannot unstake ${dto.amountTokens}. Available unlocked collateral is only ${carrier.availableCollateral}`,
      );
    }

    carrier.totalStaked -= dto.amountTokens;
    carrier.availableCollateral = carrier.totalStaked - carrier.lockedCollateral;
    if (carrier.totalStaked === 0) {
      carrier.isAccredited = false;
    }
    carrier.lastUpdated = Date.now();

    this.logger.log(`Carrier ${carrier.carrierAddress} unstaked ${dto.amountTokens} collateral. Remaining: ${carrier.totalStaked}`);
    return carrier;
  }

  getManufacturerIndemnity(manufacturerAddress: string): number {
    if (!isAddress(manufacturerAddress)) {
      throw new BadRequestException(`Invalid manufacturer address: ${manufacturerAddress}`);
    }
    return this.indemnityLedger.get(getAddress(manufacturerAddress)) || 0;
  }
}
