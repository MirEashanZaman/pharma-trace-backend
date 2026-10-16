import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import {
  RegulatoryRuleEvaluator,
  DossierCryptographicSigner,
  ComplianceAuditLogger,
  ComplianceEngine,
} from './solid/services/compliance-services';
import {
  AbstractAttestationAnchor,
  DirectOnChainAnchor,
} from './solid/anchors/attestation-anchor';
import {
  FdaDscsaRule,
  EuFmdRule,
  WhoColdChainRule,
  HealthCanadaRule,
} from './solid/rules/compliance-rules';

@Module({
  controllers: [ComplianceController],
  providers: [
    RegulatoryRuleEvaluator,
    DossierCryptographicSigner,
    ComplianceAuditLogger,
    {
      provide: AbstractAttestationAnchor,
      useClass: DirectOnChainAnchor,
    },
    {
      provide: 'COMPLIANCE_RULES',
      useFactory: () => [
        new FdaDscsaRule(),
        new EuFmdRule(),
        new WhoColdChainRule(),
        new HealthCanadaRule(),
      ],
    },
    {
      provide: ComplianceEngine,
      useFactory: (
        evaluator: RegulatoryRuleEvaluator,
        signer: DossierCryptographicSigner,
        auditLogger: ComplianceAuditLogger,
        anchor: AbstractAttestationAnchor,
        rules: any[],
      ) => new ComplianceEngine(evaluator, signer, auditLogger, anchor, rules),
      inject: [
        RegulatoryRuleEvaluator,
        DossierCryptographicSigner,
        ComplianceAuditLogger,
        AbstractAttestationAnchor,
        'COMPLIANCE_RULES',
      ],
    },
  ],
  exports: [
    RegulatoryRuleEvaluator,
    DossierCryptographicSigner,
    ComplianceAuditLogger,
    ComplianceEngine,
  ],
})
export class ComplianceModule {}
