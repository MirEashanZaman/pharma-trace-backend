import { Module } from '@nestjs/common';
import { IotController } from './iot.controller';
import { IotService } from './iot.service';
import { IotGateway } from './iot.gateway';
import { DrugEventsModule } from '../events/drug-events.module';
import { HardwareOracleService } from './oracle/hardware-oracle.service';
import { NfcVerificationService } from './nfc/nfc-verification.service';
import { SensorConsensusEngine } from './consensus/sensor-consensus.engine';

@Module({
    imports: [
        DrugEventsModule,
    ],
    controllers: [
        IotController,
    ],
    providers: [
        IotService,
        IotGateway,
        HardwareOracleService,
        NfcVerificationService,
        SensorConsensusEngine,
    ],
    exports: [
        IotGateway,
        IotService,
        HardwareOracleService,
        NfcVerificationService,
        SensorConsensusEngine,
    ],
})
export class IotModule { }