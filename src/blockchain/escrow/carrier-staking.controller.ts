import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CarrierStakingService } from './carrier-staking.service';
import {
  DepositStakeDto,
  LockBondDto,
  UnstakeDto,
} from './carrier-staking.types';
import { CheckpointCluster } from '../../iot/consensus/sensor-consensus.engine';

export class ResolveBondDto {
  shipmentId!: string;
  sensorClusters!: CheckpointCluster[];
  slashPercentage?: number;
}

@Controller('blockchain/carrier-staking')
export class CarrierStakingController {
  constructor(private readonly stakingService: CarrierStakingService) {}

  @Post('deposit')
  @HttpCode(HttpStatus.CREATED)
  depositStake(@Body() dto: DepositStakeDto) {
    return this.stakingService.depositStake(dto);
  }

  @Get('account/:carrierAddress')
  getAccount(@Param('carrierAddress') carrierAddress: string) {
    return this.stakingService.getAccount(carrierAddress);
  }

  @Post('bond/lock')
  @HttpCode(HttpStatus.CREATED)
  lockShipmentBond(@Body() dto: LockBondDto) {
    return this.stakingService.lockShipmentBond(dto);
  }

  @Get('bond/:shipmentId')
  getBond(@Param('shipmentId') shipmentId: string) {
    return this.stakingService.getBond(shipmentId);
  }

  @Post('bond/resolve')
  @HttpCode(HttpStatus.OK)
  resolveBond(@Body() dto: ResolveBondDto) {
    return this.stakingService.evaluateAndResolveBond(
      dto.shipmentId,
      dto.sensorClusters,
      dto.slashPercentage,
    );
  }

  @Post('unstake')
  @HttpCode(HttpStatus.OK)
  unstake(@Body() dto: UnstakeDto) {
    return this.stakingService.unstake(dto);
  }

  @Get('indemnity/:manufacturerAddress')
  getIndemnity(@Param('manufacturerAddress') manufacturerAddress: string) {
    return {
      manufacturerAddress,
      totalIndemnified: this.stakingService.getManufacturerIndemnity(manufacturerAddress),
    };
  }
}
