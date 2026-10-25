import { Injectable, BadRequestException, NotFoundException, Logger, Optional } from '@nestjs/common';
import { keccak256, toUtf8Bytes, getAddress, isAddress, parseEther } from 'ethers';
import {
  SensorConsensusEngine,
  CheckpointCluster,
  EscrowConsensusReport,
} from '../../iot/consensus/sensor-consensus.engine';
import { BlockchainService } from '../blockchain.service';

export enum EscrowState {
  FUNDED = 'FUNDED',
  RELEASED = 'RELEASED',
  REFUNDED = 'REFUNDED',
  DISPUTED = 'DISPUTED',
}

export interface EscrowRecord {
  orderId: string;
  buyer: string;
  seller: string;
  amountEth: number;
  drugSerialNumber: string;
  status: EscrowState;
  createdAt: number;
  timeoutTimestamp: number;
  coldChainCompliant: boolean;
  custodyAccepted: boolean;
  settlementTxHash?: string;
  refundReason?: string;
}

export interface CreateEscrowDto {
  buyer: string;
  seller: string;
  amountEth: number;
  drugSerialNumber: string;
  timeoutHours?: number;
}

@Injectable()
export class PharmaEscrowService {
  private readonly logger = new Logger(PharmaEscrowService.name);
  private readonly escrows: Map<string, EscrowRecord> = new Map();

  constructor(
    private readonly consensusEngine: SensorConsensusEngine = new SensorConsensusEngine(),
    @Optional() private readonly blockchainService?: BlockchainService,
  ) {}

  async createEscrowOrder(dto: CreateEscrowDto): Promise<EscrowRecord> {
    if (!isAddress(dto.buyer) || !isAddress(dto.seller)) {
      throw new BadRequestException('Buyer and seller must be valid Ethereum addresses');
    }

    if (dto.amountEth <= 0) {
      throw new BadRequestException('Escrow settlement amount must be greater than zero');
    }

    const payload = `${dto.buyer}:${dto.seller}:${dto.drugSerialNumber}:${Date.now()}`;
    const orderId = keccak256(toUtf8Bytes(payload));
    const nowSec = Math.floor(Date.now() / 1000);
    const timeoutSec = (dto.timeoutHours ?? 72) * 3600;

    const contract = this.blockchainService?.getEscrowContract();
    if (contract) {
      try {
        const tx = await contract.createEscrow(
          orderId,
          getAddress(dto.seller),
          dto.drugSerialNumber,
          timeoutSec,
          { value: parseEther(dto.amountEth.toString()) },
        );
        const receipt = await tx.wait();
        this.logger.log(`Created escrow on-chain: ${receipt.hash}`);
      } catch (err: any) {
        this.logger.warn(`On-chain escrow creation failed: ${err.message}`);
      }
    }

    const record: EscrowRecord = {
      orderId,
      buyer: getAddress(dto.buyer),
      seller: getAddress(dto.seller),
      amountEth: dto.amountEth,
      drugSerialNumber: dto.drugSerialNumber,
      status: EscrowState.FUNDED,
      createdAt: nowSec,
      timeoutTimestamp: nowSec + timeoutSec,
      coldChainCompliant: false,
      custodyAccepted: false,
    };

    this.escrows.set(orderId, record);
    this.logger.log(`Created commercial delivery escrow order ${orderId} for serial ${dto.drugSerialNumber} (${dto.amountEth} ETH)`);
    return record;
  }

  async evaluateAndReleaseEscrow(
    orderId: string,
    custodyAccepted: boolean,
    coldChainReadings: number[],
    minTemp: number = 2.0,
    maxTemp: number = 8.0,
  ): Promise<{ success: boolean; released: boolean; reason?: string; order: EscrowRecord }> {
    const order = await this.getEscrow(orderId);

    if (order.status !== EscrowState.FUNDED) {
      throw new BadRequestException(`Escrow ${orderId} is already in ${order.status} state`);
    }

    if (!custodyAccepted) {
      return {
        success: false,
        released: false,
        reason: 'Buyer has not signed EIP-712 custody acceptance handshake',
        order,
      };
    }

    const isTemperatureCompliant =
      coldChainReadings.length > 0 &&
      coldChainReadings.every((reading) => reading >= minTemp && reading <= maxTemp);

    if (!isTemperatureCompliant) {
      order.status = EscrowState.DISPUTED;
      order.coldChainCompliant = false;
      this.escrows.set(orderId, order);
      return {
        success: false,
        released: false,
        reason: `Cold-chain temperature violation detected in transit readings outside [${minTemp}, ${maxTemp}] deg C`,
        order,
      };
    }

    let settlementTxHash: string | undefined;
    const contract = this.blockchainService?.getEscrowContract();
    if (contract) {
      try {
        const tx = await contract.recordComplianceAndHandshake(orderId, true, true);
        const receipt = await tx.wait();
        settlementTxHash = receipt.hash;
        this.logger.log(`On-chain escrow settlement executed: ${settlementTxHash}`);
      } catch (err: any) {
        this.logger.warn(`On-chain escrow settlement failed: ${err.message}`);
      }
    }
    if (!settlementTxHash) {
      settlementTxHash = keccak256(toUtf8Bytes(`SETTLE:${orderId}:${Date.now()}`));
    }

    order.coldChainCompliant = true;
    order.custodyAccepted = true;
    order.status = EscrowState.RELEASED;
    order.settlementTxHash = settlementTxHash;

    this.escrows.set(orderId, order);
    this.logger.log(`Escrow ${orderId} released to seller ${order.seller} (${order.amountEth} ETH)`);

    return {
      success: true,
      released: true,
      order,
    };
  }

  async evaluateAndReleaseWithConsensus(
    orderId: string,
    custodyAccepted: boolean,
    clusters: CheckpointCluster[],
    minTemp: number = 2.0,
    maxTemp: number = 8.0,
    outlierTolerance: number = 2.5,
  ): Promise<{
    success: boolean;
    released: boolean;
    reason?: string;
    report: EscrowConsensusReport;
    order: EscrowRecord;
  }> {
    const order = await this.getEscrow(orderId);

    if (order.status !== EscrowState.FUNDED) {
      throw new BadRequestException(`Escrow ${orderId} is already in ${order.status} state`);
    }

    const report = this.consensusEngine.evaluateTransitSeries(
      orderId,
      clusters,
      minTemp,
      maxTemp,
      outlierTolerance,
    );

    if (!custodyAccepted) {
      return {
        success: false,
        released: false,
        reason: 'Buyer has not signed EIP-712 custody acceptance handshake',
        report,
        order,
      };
    }

    if (!report.isSettlementApproved) {
      order.status = EscrowState.DISPUTED;
      order.coldChainCompliant = false;
      this.escrows.set(orderId, order);
      return {
        success: false,
        released: false,
        reason: report.settlementReason,
        report,
        order,
      };
    }

    let settlementTxHash: string | undefined;
    const consensusContract = this.blockchainService?.getEscrowContract();
    if (consensusContract) {
      try {
        const tx = await consensusContract.recordComplianceAndHandshake(orderId, true, true);
        const receipt = await tx.wait();
        settlementTxHash = receipt.hash;
        this.logger.log(`On-chain consensus settlement executed: ${settlementTxHash}`);
      } catch (err: any) {
        this.logger.warn(`On-chain consensus settlement failed: ${err.message}`);
      }
    }
    if (!settlementTxHash) {
      settlementTxHash = keccak256(toUtf8Bytes(`SETTLE_CONSENSUS:${orderId}:${Date.now()}`));
    }

    order.coldChainCompliant = true;
    order.custodyAccepted = true;
    order.status = EscrowState.RELEASED;
    order.settlementTxHash = settlementTxHash;

    this.escrows.set(orderId, order);
    this.logger.log(
      `Escrow ${orderId} released via multi-sensor consensus to seller ${order.seller} (${order.amountEth} ETH)`,
    );

    return {
      success: true,
      released: true,
      report,
      order,
    };
  }

  async triggerBreachRefund(orderId: string, reason: string): Promise<EscrowRecord> {
    const order = await this.getEscrow(orderId);

    if (order.status === EscrowState.RELEASED) {
      throw new BadRequestException('Cannot refund an escrow order that has already been released');
    }

    const contract = this.blockchainService?.getEscrowContract();
    if (contract) {
      try {
        const tx = await contract.triggerSpoilageRefund(orderId, reason);
        await tx.wait();
        this.logger.log(`On-chain escrow refund triggered: ${orderId}`);
      } catch (err: any) {
        this.logger.warn(`On-chain escrow refund failed: ${err.message}`);
      }
    }

    order.status = EscrowState.REFUNDED;
    order.refundReason = reason;
    this.escrows.set(orderId, order);
    this.logger.log(`Escrow ${orderId} refunded to buyer ${order.buyer}. Reason: ${reason}`);
    return order;
  }

  async getEscrow(orderId: string): Promise<EscrowRecord> {
    const record = this.escrows.get(orderId);
    if (!record) {
      throw new NotFoundException(`Escrow order ${orderId} not found`);
    }
    return record;
  }

  async checkAutomationUpkeep(): Promise<{ upkeepNeeded: boolean; orderId?: string; actionType?: number; reason?: string }> {
    const nowSec = Math.floor(Date.now() / 1000);
    for (const [orderId, order] of this.escrows.entries()) {
      if (order.status === EscrowState.FUNDED) {
        if (order.coldChainCompliant && order.custodyAccepted) {
          return {
            upkeepNeeded: true,
            orderId,
            actionType: 1,
            reason: 'Conditions met for automated release to seller',
          };
        }
        if (nowSec > order.timeoutTimestamp) {
          return {
            upkeepNeeded: true,
            orderId,
            actionType: 2,
            reason: 'Timeout SLA exceeded for automated refund to buyer',
          };
        }
      }
    }
    return { upkeepNeeded: false };
  }

  async performAutomationUpkeep(orderId: string, actionType: number): Promise<EscrowRecord> {
    const order = await this.getEscrow(orderId);
    if (order.status !== EscrowState.FUNDED) {
      throw new BadRequestException(`Order ${orderId} is not in funded status`);
    }

    if (actionType === 1) {
      if (!order.coldChainCompliant || !order.custodyAccepted) {
        throw new BadRequestException('Compliance conditions not met for automated release');
      }
      order.status = EscrowState.RELEASED;
      order.settlementTxHash = keccak256(toUtf8Bytes(`KEEPER_SETTLE:${orderId}:${Date.now()}`));
      this.escrows.set(orderId, order);
      this.logger.log(`Chainlink Automation Keeper performed release for escrow ${orderId}`);
      return order;
    }

    if (actionType === 2) {
      order.status = EscrowState.REFUNDED;
      order.refundReason = 'Chainlink Automation Keeper: Delivery SLA timeout refund';
      this.escrows.set(orderId, order);
      this.logger.log(`Chainlink Automation Keeper performed timeout refund for escrow ${orderId}`);
      return order;
    }

    throw new BadRequestException(`Unsupported upkeep action type: ${actionType}`);
  }
}

