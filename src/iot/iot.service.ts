import { Injectable } from '@nestjs/common';
import { DrugEventsService } from '../events/drug-events.service';
import { EventType } from '../events/event-type.enum';
import { IotGateway } from './iot.gateway';

@Injectable()
export class IotService {
    constructor(
        private readonly drugEventsService: DrugEventsService,
        private readonly iotGateway: IotGateway,
    ) { }

    generateSensorData() {
        return {
            temperature: Number(
                (2 + Math.random() * 6).toFixed(2),
            ),
            humidity: Number(
                (40 + Math.random() * 20).toFixed(2),
            ),
            location: 'Cold-Chain Warehouse A',
            timestamp: new Date(),
        };
    }

    async createTemperatureEvent(serialNumber: string) {
        const sensorData = this.generateSensorData();

        const event = await this.drugEventsService.create({
            drugSerialNumber: serialNumber,
            eventType: EventType.TEMPERATURE_MONITORED,
            eventData: sensorData,
        });

        this.iotGateway.broadcastTelemetry({
            serialNumber,
            temperature: sensorData.temperature,
            humidity: sensorData.humidity,
            timestamp: sensorData.timestamp.toISOString(),
            isExcursion: sensorData.temperature < 2 || sensorData.temperature > 8,
        });

        return event;
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
        const event = await this.drugEventsService.create({
            drugSerialNumber: serialNumber,
            eventType: EventType.TEMPERATURE_MONITORED,
            eventData: {
                ...sensorData,
                timestamp: sensorData.timestamp
                    ? new Date(sensorData.timestamp)
                    : new Date(),
            },
        });

        this.iotGateway.broadcastTelemetry({
            serialNumber,
            temperature: sensorData.temperature,
            humidity: sensorData.humidity,
            timestamp: sensorData.timestamp || new Date().toISOString(),
            isExcursion: sensorData.temperature < 2 || sensorData.temperature > 8,
        });

        return event;
    }

    simulateTelemetry(data: {
        serialNumber?: string;
        temperature: number;
        humidity: number;
        location?: string;
    }) {
        const isExcursion = data.temperature < 2 || data.temperature > 8;
        const telemetry = {
            serialNumber: data.serialNumber || 'RX-994821',
            temperature: Number(data.temperature),
            humidity: Number(data.humidity),
            timestamp: new Date().toISOString(),
            isExcursion,
            location: data.location || 'Cold-Chain Mobile Reefer Unit',
        };

        this.iotGateway.broadcastTelemetry(telemetry);
        return telemetry;
    }
}