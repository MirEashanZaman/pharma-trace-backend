import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
} from '@nestjs/common';

@Controller('api/sensor')
export class SensorController {
    @Post()
    receiveData(@Body() sensorData: any) {
        return { status: 'success', message: 'Data received by PharmaTrace-ES', data: sensorData };
    }

    @Get()
    getSensorReadings(
        @Query('deviceId') deviceId?: string,
        @Query('limit') limit?: string,
    ) {
        return {
            deviceId: deviceId || 'all',
            limit: limit ? Number(limit) : 50,
            active: true,
            timestamp: new Date().toISOString(),
        };
    }

    @Get(':deviceId')
    getSensorStatus(@Param('deviceId') deviceId: string) {
        return {
            deviceId,
            status: 'ONLINE',
            batteryLevel: 98,
            firmwareVersion: '1.4.2-esp32',
            lastPing: new Date().toISOString(),
        };
    }

    @Put(':deviceId/config')
    updateSensorConfig(
        @Param('deviceId') deviceId: string,
        @Body()
        config: {
            sampleRateMs?: number;
            tempUpperThreshold?: number;
            tempLowerThreshold?: number;
        },
    ) {
        return {
            deviceId,
            updated: true,
            appliedConfig: config,
        };
    }

    @Delete(':deviceId')
    deregisterSensor(@Param('deviceId') deviceId: string) {
        return {
            deviceId,
            deregistered: true,
            decommissionedAt: new Date().toISOString(),
        };
    }
}