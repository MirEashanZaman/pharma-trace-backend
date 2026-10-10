import { Injectable } from '@nestjs/common';
import { DrugEvent } from '../entities/drug-event.entity';
import { EventObserver } from '../observers/event.observer';

@Injectable()
export class EventPublisher {
    private observers: EventObserver[] = [];

    subscribe(observer: EventObserver): void {
        this.observers.push(observer);
    }

    publish(event: DrugEvent): void {
        for (const observer of this.observers) {
            observer.update(event);
        }
    }
}