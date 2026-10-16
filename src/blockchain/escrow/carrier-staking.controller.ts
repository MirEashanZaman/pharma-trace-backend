import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
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

  @Get('bonds')
  listBonds(
    @Query('carrierAddress') carrierAddress?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stakingService.listBonds({
      carrierAddress,
      status,
      limit: limit ? Number(limit) : undefined,
    });
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

  @Put('account/:carrierAddress/accreditation')
  updateAccreditation(
    @Param('carrierAddress') carrierAddress: string,
    @Body() body: { isAccredited: boolean },
  ) {
    const account = this.stakingService.getAccount(carrierAddress);
    account.isAccredited = body.isAccredited;
    account.lastUpdated = Date.now();
    return account;
  }

  @Delete('bond/:shipmentId')
  cancelBond(
    @Param('shipmentId') shipmentId: string,
    @Query('reason') reason?: string,
  ) {
    return this.stakingService.cancelBond(shipmentId, reason);
  }
}
