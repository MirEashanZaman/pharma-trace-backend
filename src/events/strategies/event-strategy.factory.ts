import { Injectable } from '@nestjs/common';

import { EventStrategy } from './event.strategy';
import { ManufacturedStrategy } from './manufactured.strategy';
import { ShippedStrategy } from './shipped.strategy';
import { ReceivedStrategy } from './received.strategy';
import { TemperatureMonitoredStrategy } from './temperature-monitored.strategy';

@Injectable()
export class EventStrategyFactory {
    constructor(
        private readonly manufacturedStrategy: ManufacturedStrategy,
        private readonly shippedStrategy: ShippedStrategy,
        private readonly receivedStrategy: ReceivedStrategy,
        private readonly temperatureMonitoredStrategy: TemperatureMonitoredStrategy,
    ) { }

    getStrategy(eventType: string): EventStrategy | null {
        switch (eventType) {
            case 'MANUFACTURED':
                return this.manufacturedStrategy;

            case 'SHIPPED':
                return this.shippedStrategy;

            case 'RECEIVED':
                return this.receivedStrategy;

            case 'TEMPERATURE_MONITORED':
                return this.temperatureMonitoredStrategy;

            default:
                return null;
        }
    }
}