import { Injectable } from '@nestjs/common';
import { DrugEvent } from '../entities/drug-event.entity';
import { EventObserver } from './event.observer';

@Injectable()
export class AuditObserver implements EventObserver {
    update(event: DrugEvent): void {
        console.log(
            `[AUDIT] Drug Event Recorded: ${event.drugSerialNumber} - ${event.eventType}`,
        );
    }
}