import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheckResult, HealthService } from './health.service';

@ApiTags('System Health')
@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get('live')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Liveness probe for container orchestration' })
    @ApiResponse({ status: 200, description: 'Service process is alive' })
    getLiveness(): { status: string; uptime: number; timestamp: string } {
        return this.healthService.getLiveness();
    }

    @Get('ready')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Readiness probe verifying PostgreSQL and Redis connections' })
    @ApiResponse({ status: 200, description: 'All backing dependencies are operational' })
    @ApiResponse({ status: 503, description: 'Core dependencies unavailable' })
    async getReadiness(): Promise<HealthCheckResult> {
        return this.healthService.getReadiness();
    }

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'General health check endpoint' })
    async getHealth(): Promise<HealthCheckResult> {
        return this.healthService.getReadiness();
    }
}
