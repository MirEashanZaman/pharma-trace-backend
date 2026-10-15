import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { VerifiableCredentialService } from './verifiable-credential.service';
import { StatusList2021Registry } from './status-list-2021.registry';
import { Wallet } from 'ethers';
import type {
  VerifiableCredential,
  VerifiablePresentation,
  PresentationDefinition,
} from './vc.types';

@Controller('blockchain/vc')
export class VcController {
  constructor(
    private readonly vcService: VerifiableCredentialService,
    private readonly statusListRegistry: StatusList2021Registry,
  ) {}

  @Post('issue/batch-release')
  async issueBatchRelease(@Body() body: any) {
    const issuerWallet = new Wallet(
      body.issuerPrivateKey || '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d',
    );
    return this.vcService.issueBatchReleaseCredential(body.subject, issuerWallet);
  }

  @Post('issue/carrier')
  async issueCarrierAccreditation(@Body() body: any) {
    const issuerWallet = new Wallet(
      body.issuerPrivateKey || '0x6cbed15c793ce57650b9877cf2182d8001e7294eb314064785645f93a3a13186',
    );
    return this.vcService.issueCarrierAccreditationCredential(
      body.subject,
      body.carrierAddress,
      issuerWallet,
    );
  }

  @Post('verify')
  async verifyCredential(@Body() body: { credential: any }) {
    return this.vcService.verifyCredential(body.credential);
  }

  @Post('verify-presentation')
  async verifyPresentation(@Body() body: {
    presentation: any;
    definition: any;
    challenge: string;
    domain?: string;
  }) {
    return this.vcService.verifyPresentationExchange(
      body.presentation,
      body.definition,
      body.challenge,
      body.domain,
    );
  }

  @Post('enforce-handover')
  async enforceHandover(@Body() body: {
    presentation: any;
    drugSerialNumber: string;
    holderAddress: string;
    challenge: string;
  }) {
    return this.vcService.enforceCustodyHandoverPrerequisites(
      body.presentation,
      body.drugSerialNumber,
      body.holderAddress,
      body.challenge,
    );
  }

  @Post('revoke')
  revokeCredential(@Body() body: {
    credentialId: string;
    statusListIndex: number;
    revokedBy: string;
    reason?: string;
  }) {
    return this.vcService.revokeCredential(
      body.credentialId,
      body.statusListIndex,
      body.revokedBy,
      body.reason,
    );
  }

  @Get('status-list')
  getStatusList() {
    return this.statusListRegistry.exportStatusListCredential(
      'did:ethr:0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    );
  }
}
