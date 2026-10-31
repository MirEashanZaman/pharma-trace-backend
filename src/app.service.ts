import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from './redis/redis.service';
import { BlockchainService } from './blockchain/blockchain.service';

@Injectable()
export class AppService {
  constructor(
    @Optional() private readonly dataSource?: DataSource,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly blockchainService?: BlockchainService,
  ) {}

  getHello(): string {
    return 'PharmaTrace Enterprise API Gateway Active';
  }

  async getHealth() {
    const dbStart = Date.now();
    let dbStatus = 'healthy';
    let dbLatency = 0;
    if (this.dataSource) {
      try {
        await this.dataSource.query('SELECT 1');
        dbLatency = Date.now() - dbStart;
      } catch {
        dbStatus = 'degraded';
      }
    }

    let redisStatus = 'fallback_memory';
    if (this.redisService) {
      const isHealthy = await this.redisService.isHealthy();
      redisStatus = isHealthy ? 'healthy' : 'fallback_memory';
    }

    let blockchainStatus = 'hybrid_ready';
    let blockNumber: number | null = null;
    const provider = this.blockchainService?.getProvider();
    if (provider) {
      try {
        blockNumber = await provider.getBlockNumber();
        blockchainStatus = 'synced';
      } catch {
        blockchainStatus = 'offline_or_local';
      }
    }

    const memory = process.memoryUsage();
    return {
      status: dbStatus === 'healthy' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      services: {
        database: { status: dbStatus, latencyMs: dbLatency },
        redis: { status: redisStatus },
        blockchain: { status: blockchainStatus, blockNumber },
      },
      system: {
        nodeVersion: process.version,
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
        rssMb: Math.round(memory.rss / 1024 / 1024),
      },
    };
  }
}
