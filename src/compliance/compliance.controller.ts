import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Inject,
} from '@nestjs/common';
import {
  ComplianceEngine,
  RegulatoryRuleEvaluator,
  ComplianceAuditLogger,
} from './solid/services/compliance-services';
import type { IComplianceRule, ComplianceData } from './solid/compliance.types';

export class EvaluateComplianceDto {
  serialNumber!: string;
  gtin!: string;
  batchNumber!: string;
  temperatures!: number[];
  tamperSealIntact!: boolean;
  expiryDate!: string;
  jurisdiction?: string;
  metadata?: Record<string, any>;
}

export class AnchorComplianceDto {
  data!: EvaluateComplianceDto;
  secret?: string;
}

@Controller('compliance')
export class ComplianceController {
  constructor(
    private readonly complianceEngine: ComplianceEngine,
    private readonly ruleEvaluator: RegulatoryRuleEvaluator,
    private readonly auditLogger: ComplianceAuditLogger,
    @Inject('COMPLIANCE_RULES')
    private readonly rules: IComplianceRule[],
  ) {}

  @Post('evaluate')
  evaluateCompliance(@Body() data: EvaluateComplianceDto) {
    const results = this.ruleEvaluator.evaluateAll(this.rules, data as ComplianceData);
    const passed = results.every((r) => r.passed);
    return {
      passed,
      results,
      serialNumber: data.serialNumber,
      gtin: data.gtin,
      batchNumber: data.batchNumber,
    };
  }

  @Post('anchor')
  async anchorCompliance(
    @Body() body: AnchorComplianceDto,
  ) {
    const secret = body.secret || 'pharmatrace-default-signing-key';
    return this.complianceEngine.processDossier(body.data as ComplianceData, secret);
  }

  @Get('rules')
  listRules(@Query('authority') authority?: string) {
    if (authority) {
      return this.rules.filter((r) => r.authority.toUpperCase() === authority.toUpperCase());
    }
    return this.rules.map((r) => ({
      ruleId: r.ruleId,
      authority: r.authority,
    }));
  }

  @Get('audit')
  getAuditTrail(@Query('limit') limit?: string) {
    const logs = this.auditLogger.getAuditTrail();
    if (limit) {
      return logs.slice(-Number(limit));
    }
    return logs;
  }

  @Get('verify/:batchNumber/:digest')
  async verifyAttestation(
    @Param('batchNumber') batchNumber: string,
    @Param('digest') digest: string,
  ) {
    const valid = await this.complianceEngine.verifyAnchoredDossier(batchNumber, digest);
    return { batchNumber, digest, valid };
  }

  @Put('audit/:index/note')
  appendAuditCorrection(
    @Param('index') index: string,
    @Body() body: { note: string },
  ) {
    const entry = `Correction at entry ${index}: ${body.note}`;
    return this.auditLogger.logAudit(entry);
  }

  @Delete('audit')
  clearAuditLogs(@Query('confirm') confirm?: string) {
    if (confirm === 'true') {
      this.auditLogger.clearAuditTrail();
      return { cleared: true };
    }
    return { cleared: false, message: 'Confirmation required' };
  }
}
