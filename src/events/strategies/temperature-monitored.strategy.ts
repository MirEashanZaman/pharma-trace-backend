import { Injectable } from '@nestjs/common';

import { DrugEvent } from '../entities/drug-event.entity';
import { EventStrategy } from './event.strategy';

@Injectable()
export class TemperatureMonitoredStrategy implements EventStrategy {
    process(event: DrugEvent): void {
        console.log(
            `[STRATEGY] Temperature monitoring processed for ${event.drugSerialNumber}`,
        );
    }
}