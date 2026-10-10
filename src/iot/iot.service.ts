import { Injectable } from '@nestjs/common';

import { DrugEventsService } from '../events/drug-events.service';
import { EventType } from '../events/event-type.enum';

@Injectable()
export class IotService {
    constructor(
        private readonly drugEventsService: DrugEventsService,
    ) { }

    generateSensorData() {
        return {
            temperature: Number(
                (20 + Math.random() * 15).toFixed(2),
            ),
            humidity: Number(
                (40 + Math.random() * 30).toFixed(2),
            ),
            location: 'Dhaka Warehouse',
            timestamp: new Date(),
        };
    }

    async createTemperatureEvent(serialNumber: string) {
        const sensorData = this.generateSensorData();

        return this.drugEventsService.create({
            drugSerialNumber: serialNumber,
            eventType: EventType.TEMPERATURE_MONITORED,
            eventData: sensorData,
        });
    }

    async createSensorEvent(
        serialNumber: string,
        sensorData: {
            temperature: number;
            humidity: number;
            location?: string;
            latitude?: number;
            longitude?: number;
            timestamp?: string;
        },
    ) {
        return this.drugEventsService.create({
            drugSerialNumber: serialNumber,
            eventType: EventType.TEMPERATURE_MONITORED,
            eventData: {
                ...sensorData,
                timestamp: sensorData.timestamp
                    ? new Date(sensorData.timestamp)
                    : new Date(),
            },
        });
    }
}