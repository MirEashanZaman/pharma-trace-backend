export type BondStatus = 'NONE' | 'LOCKED' | 'RELEASED' | 'SLASHED';

export interface CarrierStakeAccount {
  carrierAddress: string;
  totalStaked: number;
  lockedCollateral: number;
  availableCollateral: number;
  totalSlashed: number;
  totalIndemnified: number;
  isAccredited: boolean;
  tokenSymbol: string;
  lastUpdated: number;
}

export interface ShipmentBond {
  shipmentId: string;
  carrierAddress: string;
  manufacturerAddress: string;
  drugSerialNumber: string;
  bondAmount: number;
  status: BondStatus;
  minTemp: number;
  maxTemp: number;
  lockedAt: number;
  resolvedAt?: number;
  resolutionReason?: string;
  slashedAmount?: number;
  consensusReportHash?: string;
}

export interface CarrierBondResolution {
  shipmentId: string;
  status: BondStatus;
  bondAmount: number;
  slashedAmount: number;
  indemnityRecipient?: string;
  reason: string;
  isolatedFaultsCount: number;
  clusterMedianTemp: number;
  consensusReportHash: string;
}

export class DepositStakeDto {
  carrierAddress!: string;
  amountTokens!: number;
  tokenSymbol?: string;
}

export class LockBondDto {
  shipmentId!: string;
  carrierAddress!: string;
  manufacturerAddress!: string;
  drugSerialNumber!: string;
  bondAmount!: number;
  minTemp?: number;
  maxTemp?: number;
}

export class UnstakeDto {
  carrierAddress!: string;
  amountTokens!: number;
}
