import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { GovernanceTimelockService, GovernanceProposal } from './governance-timelock.service';

@Controller('blockchain/governance')
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceTimelockService) {}

  @Get('guardians')
  getGuardians() {
    return this.governanceService.getGuardians();
  }

  @Get('proposals')
  listProposals(): GovernanceProposal[] {
    return this.governanceService.listProposals();
  }

  @Get('proposals/:id')
  async getProposal(@Param('id') id: string): Promise<GovernanceProposal> {
    return this.governanceService.getProposal(id);
  }

  @Post('propose')
  async createProposal(@Body() body: any): Promise<GovernanceProposal> {
    return this.governanceService.createProposal(body);
  }

  @Post('confirm')
  async confirmProposal(@Body() body: any): Promise<GovernanceProposal> {
    return this.governanceService.confirmProposal(body.proposalId, body.guardianAddress);
  }

  @Post('execute')
  async executeProposal(@Body() body: any) {
    return this.governanceService.executeProposal(body.proposalId, body.executorAddress);
  }

  @Post('cancel')
  async cancelProposal(@Body() body: any): Promise<GovernanceProposal> {
    return this.governanceService.cancelProposal(body.proposalId, body.guardianAddress, body.reason);
  }
}
