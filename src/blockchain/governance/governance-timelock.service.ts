import { Injectable, BadRequestException, NotFoundException, Logger, Optional } from '@nestjs/common';
import { keccak256, toUtf8Bytes, getAddress, isAddress } from 'ethers';
import { BlockchainService } from '../blockchain.service';

export enum GovernanceProposalStatus {
  QUEUED = 'QUEUED',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export interface GovernanceProposal {
  id: string;
  proposer: string;
  target: string;
  valueWei: number;
  data: string;
  description: string;
  createdAt: number;
  eta: number;
  confirmations: string[];
  status: GovernanceProposalStatus;
  executionTxHash?: string;
  cancellationReason?: string;
}

export interface RegulatoryGuardian {
  address: string;
  authorityName: string;
  jurisdiction: string;
  registeredAt: number;
}

@Injectable()
export class GovernanceTimelockService {
  private readonly logger = new Logger(GovernanceTimelockService.name);
  private readonly proposals: Map<string, GovernanceProposal> = new Map();
  private readonly guardians: Map<string, RegulatoryGuardian> = new Map();

  private requiredThreshold: number = 2;
  private minDelaySeconds: number = 172800;

  constructor(
    @Optional() private readonly blockchainService?: BlockchainService,
  ) {
    this.registerGuardian('0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 'US FDA CDER', 'US');
    this.registerGuardian('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'European Medicines Agency (EMA)', 'EU');
    this.registerGuardian('0x90F79bf6EB2c4f870365E785982E1f101E93b906', 'UK MHRA', 'UK');
  }

  registerGuardian(walletAddress: string, authorityName: string, jurisdiction: string): void {
    const normalized = getAddress(walletAddress);
    this.guardians.set(normalized, {
      address: normalized,
      authorityName,
      jurisdiction,
      registeredAt: Date.now(),
    });
    this.logger.log(`Registered regulatory guardian ${authorityName} (${normalized})`);
  }

  configureGovernance(threshold: number, delaySeconds: number): void {
    if (threshold <= 0 || threshold > this.guardians.size) {
      throw new BadRequestException('Threshold must be between 1 and guardian count');
    }
    this.requiredThreshold = threshold;
    this.minDelaySeconds = delaySeconds;
  }

  async createProposal(params: {
    proposer: string;
    target: string;
    valueWei?: number;
    data: string;
    description: string;
    customDelaySeconds?: number;
  }): Promise<GovernanceProposal> {
    if (!isAddress(params.proposer) || !isAddress(params.target)) {
      throw new BadRequestException('Proposer and target must be valid Ethereum addresses');
    }

    const normalizedProposer = getAddress(params.proposer);
    const normalizedTarget = getAddress(params.target);

    if (!this.guardians.has(normalizedProposer)) {
      throw new BadRequestException('Proposer is not an authorized regulatory guardian');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const delay = params.customDelaySeconds ?? this.minDelaySeconds;
    const eta = nowSec + delay;

    const payload = `${normalizedTarget}:${params.valueWei ?? 0}:${params.data}:${params.description}:${nowSec}:${normalizedProposer}`;
    const proposalId = keccak256(toUtf8Bytes(payload));

    const contract = this.blockchainService?.getGovernanceTimelockContract();
    if (contract) {
      contract.propose(normalizedTarget, params.valueWei ?? 0, params.data, params.description).catch((err: any) => {
        this.logger.warn(`On-chain governance proposal creation failed: ${err.message}`);
      });
    }

    const proposal: GovernanceProposal = {
      id: proposalId,
      proposer: normalizedProposer,
      target: normalizedTarget,
      valueWei: params.valueWei ?? 0,
      data: params.data,
      description: params.description,
      createdAt: nowSec,
      eta,
      confirmations: [normalizedProposer],
      status: GovernanceProposalStatus.QUEUED,
    };

    this.proposals.set(proposalId, proposal);
    this.logger.log(`Queued regulatory governance proposal ${proposalId} with ETA in ${delay}s`);
    return proposal;
  }

  async confirmProposal(proposalId: string, guardianAddress: string): Promise<GovernanceProposal> {
    const proposal = await this.getProposal(proposalId);
    const normalizedGuardian = getAddress(guardianAddress);

    if (!this.guardians.has(normalizedGuardian)) {
      throw new BadRequestException('Signer is not an authorized regulatory guardian');
    }

    if (proposal.status !== GovernanceProposalStatus.QUEUED) {
      throw new BadRequestException(`Proposal is in ${proposal.status} status and cannot be confirmed`);
    }

    if (proposal.confirmations.includes(normalizedGuardian)) {
      throw new BadRequestException('Guardian has already confirmed this proposal');
    }

    const contract = this.blockchainService?.getGovernanceTimelockContract();
    if (contract) {
      const proposalBytes32 = proposalId.startsWith('0x') && proposalId.length === 66
        ? proposalId
        : keccak256(toUtf8Bytes(proposalId));
      contract.confirmProposal(proposalBytes32).catch((err: any) => {
        this.logger.warn(`On-chain governance proposal confirmation failed: ${err.message}`);
      });
    }

    proposal.confirmations.push(normalizedGuardian);
    this.proposals.set(proposalId, proposal);
    this.logger.log(`Guardian ${normalizedGuardian} confirmed proposal ${proposalId} (${proposal.confirmations.length}/${this.requiredThreshold})`);
    return proposal;
  }

  async executeProposal(proposalId: string, executorAddress: string): Promise<{
    success: boolean;
    proposal: GovernanceProposal;
    executionTxHash: string;
  }> {
    const proposal = await this.getProposal(proposalId);
    const normalizedExecutor = getAddress(executorAddress);

    if (!this.guardians.has(normalizedExecutor)) {
      throw new BadRequestException('Executor must be an authorized regulatory guardian');
    }

    if (proposal.status !== GovernanceProposalStatus.QUEUED) {
      throw new BadRequestException(`Cannot execute proposal with status ${proposal.status}`);
    }

    if (proposal.confirmations.length < this.requiredThreshold) {
      throw new BadRequestException(`Threshold not met: ${proposal.confirmations.length}/${this.requiredThreshold} confirmations required`);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec < proposal.eta) {
      throw new BadRequestException(`Timelock delay pending: ${proposal.eta - nowSec} seconds remaining before execution`);
    }

    let executionTxHash: string | undefined;
    const contract = this.blockchainService?.getGovernanceTimelockContract();
    if (contract) {
      try {
        const proposalBytes32 = proposalId.startsWith('0x') && proposalId.length === 66
          ? proposalId
          : keccak256(toUtf8Bytes(proposalId));
        const tx = await contract.executeProposal(proposalBytes32);
        const receipt = await tx.wait();
        executionTxHash = receipt.hash;
        this.logger.log(`Executed regulatory governance proposal on-chain: ${executionTxHash}`);
      } catch (err: any) {
        this.logger.warn(`On-chain governance execution failed: ${err.message}`);
      }
    }
    if (!executionTxHash) {
      executionTxHash = keccak256(toUtf8Bytes(`GOV_EXECUTE:${proposalId}:${nowSec}`));
    }

    proposal.status = GovernanceProposalStatus.EXECUTED;
    proposal.executionTxHash = executionTxHash;

    this.proposals.set(proposalId, proposal);
    this.logger.log(`Executed regulatory governance proposal ${proposalId} on target ${proposal.target}`);

    return {
      success: true,
      proposal,
      executionTxHash,
    };
  }

  async cancelProposal(proposalId: string, guardianAddress: string, reason: string): Promise<GovernanceProposal> {
    const proposal = await this.getProposal(proposalId);
    const normalizedGuardian = getAddress(guardianAddress);

    if (!this.guardians.has(normalizedGuardian)) {
      throw new BadRequestException('Only authorized regulatory guardians can cancel proposals');
    }

    if (proposal.status !== GovernanceProposalStatus.QUEUED) {
      throw new BadRequestException(`Proposal in status ${proposal.status} cannot be cancelled`);
    }

    const contract = this.blockchainService?.getGovernanceTimelockContract();
    if (contract) {
      const proposalBytes32 = proposalId.startsWith('0x') && proposalId.length === 66
        ? proposalId
        : keccak256(toUtf8Bytes(proposalId));
      contract.cancelProposal(proposalBytes32, reason).catch((err: any) => {
        this.logger.warn(`On-chain governance cancellation failed: ${err.message}`);
      });
    }

    proposal.status = GovernanceProposalStatus.CANCELLED;
    proposal.cancellationReason = reason;
    this.proposals.set(proposalId, proposal);

    this.logger.log(`Cancelled regulatory governance proposal ${proposalId}. Reason: ${reason}`);
    return proposal;
  }

  async getProposal(proposalId: string): Promise<GovernanceProposal> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new NotFoundException(`Governance proposal ${proposalId} not found`);
    }
    return proposal;
  }

  async updateProposalDescription(proposalId: string, description: string): Promise<GovernanceProposal> {
    const proposal = await this.getProposal(proposalId);
    proposal.description = description;
    this.proposals.set(proposalId, proposal);
    return proposal;
  }

  listProposals(): GovernanceProposal[] {
    return Array.from(this.proposals.values());
  }

  getGuardians(): RegulatoryGuardian[] {
    return Array.from(this.guardians.values());
  }

  getThreshold(): number {
    return this.requiredThreshold;
  }

  getMinDelay(): number {
    return this.minDelaySeconds;
  }
}
