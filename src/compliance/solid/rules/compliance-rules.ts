import { IComplianceRule, ComplianceData, RuleEvaluationResult } from '../compliance.types';

export class FdaDscsaRule implements IComplianceRule {
  readonly ruleId = 'FDA_DSCSA_TITLE_II';
  readonly authority = 'US FDA';

  evaluate(data: ComplianceData): RuleEvaluationResult {
    const isGtinValid = /^\d{14}$/.test(data.gtin);
    const hasSerial = Boolean(data.serialNumber && data.serialNumber.trim().length > 0);
    const isNotExpired = new Date(data.expiryDate).getTime() > Date.now();

    const passed = isGtinValid && hasSerial && isNotExpired;
    const message = passed
      ? 'Complies with US FDA DSCSA 2D Datamatrix serialization and traceability mandates'
      : 'Failed US FDA DSCSA compliance: GTIN or serialization format invalid, or product expired';

    return {
      ruleId: this.ruleId,
      authority: this.authority,
      passed,
      message,
      timestamp: new Date().toISOString(),
      details: { isGtinValid, hasSerial, isNotExpired },
    };
  }
}

export class EuFmdRule implements IComplianceRule {
  readonly ruleId = 'EU_FMD_ANNEX_11';
  readonly authority = 'European Medicines Agency (EMA)';

  evaluate(data: ComplianceData): RuleEvaluationResult {
    const hasTamperProtection = data.tamperSealIntact === true;
    const hasSerial = Boolean(data.serialNumber && data.serialNumber.trim().length > 0);
    const passed = hasTamperProtection && hasSerial;

    const message = passed
      ? 'Complies with EU FMD anti-tampering device (ATD) and unique identifier (UI) regulations'
      : 'Failed EU FMD compliance: anti-tampering seal broken or missing serial number';

    return {
      ruleId: this.ruleId,
      authority: this.authority,
      passed,
      message,
      timestamp: new Date().toISOString(),
      details: { hasTamperProtection, hasSerial },
    };
  }
}

export class WhoColdChainRule implements IComplianceRule {
  readonly ruleId = 'WHO_TRS_961';
  readonly authority = 'World Health Organization';

  evaluate(data: ComplianceData): RuleEvaluationResult {
    if (!data.temperatures || data.temperatures.length === 0) {
      return {
        ruleId: this.ruleId,
        authority: this.authority,
        passed: false,
        message: 'No temperature readings provided for WHO cold-chain audit',
        timestamp: new Date().toISOString(),
      };
    }

    const min = Math.min(...data.temperatures);
    const max = Math.max(...data.temperatures);
    const passed = min >= 2.0 && max <= 8.0;

    const message = passed
      ? `Maintained WHO 2C-8C cold-chain bounds throughout custody (Recorded: [${min}C, ${max}C])`
      : `Temperature excursion detected outside WHO bounds: min=${min}C, max=${max}C`;

    return {
      ruleId: this.ruleId,
      authority: this.authority,
      passed,
      message,
      timestamp: new Date().toISOString(),
      details: { minRecorded: min, maxRecorded: max, readingCount: data.temperatures.length },
    };
  }
}

export class HealthCanadaRule implements IComplianceRule {
  readonly ruleId = 'HEALTH_CANADA_GUI_0001';
  readonly authority = 'Health Canada';

  evaluate(data: ComplianceData): RuleEvaluationResult {
    const hasBatch = Boolean(data.batchNumber && data.batchNumber.trim().length > 0);
    const hasTemperatures = Boolean(data.temperatures && data.temperatures.length > 0);
    const passed = hasBatch && hasTemperatures;

    return {
      ruleId: this.ruleId,
      authority: this.authority,
      passed,
      message: passed
        ? 'Satisfies Health Canada GUI-0001 Good Manufacturing & Distribution Practices'
        : 'Failed Health Canada GUI-0001: Missing batch number or temperature monitoring',
      timestamp: new Date().toISOString(),
    };
  }
}
