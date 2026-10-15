import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';

import { IotService } from './iot.service';
import { HardwareOracleService } from './oracle/hardware-oracle.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('iot')
export class IotController {
    constructor(
        private readonly iotService: IotService,
        private readonly hardwareOracleService: HardwareOracleService,
    ) { }

    @Get('sensor')
    getSensorData() {
        return this.iotService.generateSensorData();
    }

    @UseGuards(JwtAuthGuard)
    @Post('drug/:serialNumber')
    createTemperatureEvent(
        @Param('serialNumber') serialNumber: string,
    ) {
        return this.iotService.createTemperatureEvent(serialNumber);
    }

    @Post('sensor/:serialNumber')
    receiveSensorData(
        @Param('serialNumber') serialNumber: string,
        @Body() sensorData: {
            temperature: number;
            humidity: number;
            location?: string;
            latitude?: number;
            longitude?: number;
            timestamp?: string;
            deviceId?: string;
            nonce?: number;
            signature?: string;
        },
    ) {
        if (sensorData.deviceId && sensorData.signature && sensorData.nonce !== undefined) {
            const verification = this.hardwareOracleService.verifyTelemetry({
                deviceId: sensorData.deviceId,
                temperature: Number(sensorData.temperature),
                humidity: Number(sensorData.humidity),
                latitude: sensorData.latitude,
                longitude: sensorData.longitude,
                timestamp: sensorData.timestamp ? new Date(sensorData.timestamp).getTime() : Date.now(),
                nonce: sensorData.nonce,
                signature: sensorData.signature,
            });
            if (!verification.isValid) {
                throw new BadRequestException(`Hardware enclave telemetry rejected: ${verification.reason}`);
            }
        }
        return this.iotService.createSensorEvent(
            serialNumber,
            sensorData,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Post('simulate')
    simulateTelemetry(
        @Body()
        data: {
            serialNumber?: string;
            temperature: number;
            humidity: number;
            location?: string;
        },
    ) {
        return this.iotService.simulateTelemetry(data);
    }
}