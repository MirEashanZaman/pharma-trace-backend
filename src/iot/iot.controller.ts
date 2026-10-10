import {
    Controller,
    Get,
    Post,
    Param,
    Body,
} from '@nestjs/common';

import { IotService } from './iot.service';

@Controller('iot')
export class IotController {
    constructor(
        private readonly iotService: IotService,
    ) { }

    @Get('sensor')
    getSensorData() {
        return this.iotService.generateSensorData();
    }

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
        },
    ) {
        return this.iotService.createSensorEvent(
            serialNumber,
            sensorData,
        );
    }
}