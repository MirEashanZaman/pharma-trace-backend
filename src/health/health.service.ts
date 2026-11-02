import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

export interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptimeSeconds: number;
    memory: {
        rssMb: number;
        heapTotalMb: number;
        heapUsedMb: number;
    };
    services: {
        database: {
            status: 'up' | 'down';
            latencyMs?: number;
        };
        redis: {
            status: 'up' | 'down';
        };
    };
}

@Injectable()
export class HealthService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly redisService: RedisService,
    ) {}

    getLiveness(): { status: string; uptime: number; timestamp: string } {
        return {
            status: 'ok',
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
        };
    }

    async getReadiness(): Promise<HealthCheckResult> {
        const mem = process.memoryUsage();
        const memory = {
            rssMb: Math.round(mem.rss / 1024 / 1024),
            heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
            heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        };

        let dbStatus: 'up' | 'down' = 'down';
        let dbLatencyMs: number | undefined;

        try {
            const start = Date.now();
            await this.dataSource.query('SELECT 1');
            dbLatencyMs = Date.now() - start;
            dbStatus = 'up';
        } catch {
            dbStatus = 'down';
        }

        let redisStatus: 'up' | 'down' = 'down';
        try {
            const isRedisHealthy = await this.redisService.isHealthy();
            redisStatus = isRedisHealthy ? 'up' : 'down';
        } catch {
            redisStatus = 'down';
        }

        const isHealthy = dbStatus === 'up';
        const isDegraded = isHealthy && redisStatus === 'down';

        const result: HealthCheckResult = {
            status: isDegraded ? 'degraded' : isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
            memory,
            services: {
                database: {
                    status: dbStatus,
                    latencyMs: dbLatencyMs,
                },
                redis: {
                    status: redisStatus,
                },
            },
        };

        if (!isHealthy) {
            throw new ServiceUnavailableException(result);
        }

        return result;
    }
}

