import { Injectable } from '@nestjs/common';
import { DrugEvent } from '../entities/drug-event.entity';
import { EventStrategy } from './event.strategy';

@Injectable()
export class ReceivedStrategy implements EventStrategy {
    process(event: DrugEvent): void {
        console.log(
            `[STRATEGY] Received event processed for ${event.drugSerialNumber}`,
        );
    }
}