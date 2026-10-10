import { DrugEvent } from '../entities/drug-event.entity';

export interface EventStrategy {
    process(event: DrugEvent): void;
}