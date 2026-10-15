import { Module } from '@nestjs/common';
import { IotController } from './iot.controller';
import { IotService } from './iot.service';
import { IotGateway } from './iot.gateway';
import { DrugEventsModule } from '../events/drug-events.module';
import { HardwareOracleService } from './oracle/hardware-oracle.service';

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
    ],
    exports: [
        IotGateway,
        IotService,
        HardwareOracleService,
    ],
})
export class IotModule { }