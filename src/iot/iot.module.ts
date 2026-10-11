import { Module } from '@nestjs/common';
import { IotController } from './iot.controller';
import { IotService } from './iot.service';
import { IotGateway } from './iot.gateway';
import { DrugEventsModule } from '../events/drug-events.module';

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
    ],
    exports: [
        IotGateway,
        IotService,
    ],
})
export class IotModule { }