import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { GovernanceTimelockService, GovernanceProposal } from './governance-timelock.service';

@Controller('blockchain/governance')
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceTimelockService) {}

  @Get('guardians')
  getGuardians() {
    return this.governanceService.getGuardians();
  }

  @Get('proposals')
  listProposals(
    @Query('status') status?: string,
    @Query('target') target?: string,
  ): GovernanceProposal[] {
    let proposals = this.governanceService.listProposals();
    if (status) {
      proposals = proposals.filter((p) => p.status === status);
    }
    if (target) {
      proposals = proposals.filter((p) => p.target.toLowerCase() === target.toLowerCase());
    }
    return proposals;
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

  @Put('proposals/:id')
  async updateProposal(
    @Param('id') id: string,
    @Body() body: { description: string },
  ): Promise<GovernanceProposal> {
    return this.governanceService.updateProposalDescription(id, body.description);
  }

  @Delete('proposals/:id')
  async cancelProposalByDelete(
    @Param('id') id: string,
    @Query('guardianAddress') guardianAddress?: string,
    @Query('reason') reason?: string,
  ): Promise<GovernanceProposal> {
    const guardian = guardianAddress || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const cancellationReason = reason || 'Cancelled via DELETE request';
    return this.governanceService.cancelProposal(id, guardian, cancellationReason);
  }
}
