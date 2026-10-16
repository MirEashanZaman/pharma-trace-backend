export interface ComplianceData {
  serialNumber: string;
  gtin: string;
  batchNumber: string;
  temperatures: number[];
  tamperSealIntact: boolean;
  expiryDate: string;
  jurisdiction?: string;
  metadata?: Record<string, any>;
}

export interface RuleEvaluationResult {
  ruleId: string;
  authority: string;
  passed: boolean;
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface IComplianceRule {
  readonly ruleId: string;
  readonly authority: string;
  evaluate(data: ComplianceData): RuleEvaluationResult;
}

export interface AnchorReceipt {
  anchorId: string;
  batchId: string;
  digest: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  mode: 'DIRECT' | 'MERKLE_BATCH';
}

export interface ISerializedTracker {
  verifySerialNumber(sn: string): boolean;
  getLifecycleState(sn: string): string;
}

export interface IColdChainAuditor {
  evaluateExcursions(readings: number[], minTemp: number, maxTemp: number): boolean;
  calculateMeanKineticTemperature(readings: number[]): number;
}

export interface ICustodySigner {
  signTransferOffer(orderId: string, recipient: string): string;
  verifyTransferAcceptance(orderId: string, signature: string, signerAddress: string): boolean;
}

export interface ICollateralStakeholder {
  getStakedBalance(carrierAddress: string): number;
  isCollateralSufficient(carrierAddress: string, requiredBond: number): boolean;
}
