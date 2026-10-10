import { Module } from '@nestjs/common';

import { IotController } from './iot.controller';
import { IotService } from './iot.service';

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
    ],
})
export class IotModule { }