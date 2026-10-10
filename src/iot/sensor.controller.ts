import { Controller, Post, Body } from '@nestjs/common';

@Controller('api/sensor')
export class SensorController {
    @Post()
    receiveData(@Body() sensorData: any) {
        console.log('Received IoT Data:', sensorData);
        return { status: 'success', message: 'Data received by PharmaTrace-ES' };
    }
}