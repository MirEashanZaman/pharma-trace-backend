import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import {
  ComplianceData,
  RuleEvaluationResult,
  IComplianceRule,
  AnchorReceipt,
  ISerializedTracker,
  IColdChainAuditor,
  ICustodySigner,
  ICollateralStakeholder,
} from '../compliance.types';
import { AbstractAttestationAnchor } from '../anchors/attestation-anchor';

@Injectable()
export class RegulatoryRuleEvaluator {
  evaluateAll(rules: IComplianceRule[], data: ComplianceData): RuleEvaluationResult[] {
    return rules.map((rule) => rule.evaluate(data));
  }
}

@Injectable()
export class DossierCryptographicSigner {
  computeDigest(payload: any): string {
    const canonicalJson = JSON.stringify(payload, Object.keys(payload).sort());
    return '0x' + createHash('sha256').update(canonicalJson).digest('hex');
  }

  signDigest(digest: string, secretKey: string): string {
    return createHmac('sha256', secretKey).update(digest).digest('hex');
  }
}

@Injectable()
export class ComplianceAuditLogger {
  private readonly logs: Array<{ timestamp: string; entry: string; hash: string }> = [];

  logAudit(entry: string): { timestamp: string; entry: string; hash: string } {
    const timestamp = new Date().toISOString();
    const hash = createHash('sha256').update(`${timestamp}:${entry}`).digest('hex');
    const record = { timestamp, entry, hash };
    this.logs.push(record);
    return record;
  }

  getAuditTrail(): Array<{ timestamp: string; entry: string; hash: string }> {
    return [...this.logs];
  }

  clearAuditTrail(): void {
    this.logs.length = 0;
  }
}

export class PharmacyDispenseNode implements ISerializedTracker {
  private readonly dispensedSerials: Set<string> = new Set();

  constructor(private readonly activeInventory: Set<string>) {}

  verifySerialNumber(sn: string): boolean {
    return this.activeInventory.has(sn) && !this.dispensedSerials.has(sn);
  }

  getLifecycleState(sn: string): string {
    if (this.dispensedSerials.has(sn)) return 'DISPENSED';
    if (this.activeInventory.has(sn)) return 'IN_STOCK';
    return 'UNKNOWN';
  }

  dispense(sn: string): boolean {
    if (!this.verifySerialNumber(sn)) return false;
    this.dispensedSerials.add(sn);
    return true;
  }
}

export class ReeferLogisticsCarrier implements IColdChainAuditor, ICollateralStakeholder {
  constructor(
    private readonly carrierAddress: string,
    private stakedBalance: number,
  ) {}

  evaluateExcursions(readings: number[], minTemp: number, maxTemp: number): boolean {
    if (readings.length === 0) return false;
    return readings.every((t) => t >= minTemp && t <= maxTemp);
  }

  calculateMeanKineticTemperature(readings: number[]): number {
    if (readings.length === 0) return 0;
    const sum = readings.reduce((acc, curr) => acc + curr, 0);
    return Number((sum / readings.length).toFixed(2));
  }

  getStakedBalance(carrierAddress: string): number {
    if (carrierAddress.toLowerCase() !== this.carrierAddress.toLowerCase()) return 0;
    return this.stakedBalance;
  }

  isCollateralSufficient(carrierAddress: string, requiredBond: number): boolean {
    return this.getStakedBalance(carrierAddress) >= requiredBond;
  }
}

@Injectable()
export class ComplianceEngine {
  private readonly logger = new Logger(ComplianceEngine.name);

  constructor(
    private readonly evaluator: RegulatoryRuleEvaluator,
    private readonly signer: DossierCryptographicSigner,
    private readonly auditLogger: ComplianceAuditLogger,
    private readonly anchor: AbstractAttestationAnchor,
    private readonly rules: IComplianceRule[] = [],
  ) {}

  async processDossier(
    data: ComplianceData,
    authoritySecret: string,
  ): Promise<{
    isCompliant: boolean;
    results: RuleEvaluationResult[];
    digest: string;
    signature: string;
    anchorReceipt: AnchorReceipt;
  }> {
    const results = this.evaluator.evaluateAll(this.rules, data);
    const isCompliant = results.every((r) => r.passed);

    const payload = {
      serialNumber: data.serialNumber,
      gtin: data.gtin,
      batchNumber: data.batchNumber,
      isCompliant,
      results,
    };

    const digest = this.signer.computeDigest(payload);
    const signature = this.signer.signDigest(digest, authoritySecret);

    const anchorReceipt = await this.anchor.anchor(data.batchNumber, digest);

    this.auditLogger.logAudit(
      `Evaluated compliance for serial ${data.serialNumber} (batch ${data.batchNumber}). Compliant=${isCompliant}. AnchorTx=${anchorReceipt.txHash}`,
    );

    return {
      isCompliant,
      results,
      digest,
      signature,
      anchorReceipt,
    };
  }

  async verifyAnchoredDossier(batchNumber: string, digest: string): Promise<boolean> {
    return this.anchor.verify(batchNumber, digest);
  }
}
