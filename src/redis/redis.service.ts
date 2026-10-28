import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private client: Redis | null = null;
    private readonly inMemoryCache = new Map<string, { value: any; expiry?: number }>();
    private isConnected = false;

    async onModuleInit() {
        const host = process.env.REDIS_HOST || 'localhost';
        const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
        const password = process.env.REDIS_PASSWORD || undefined;

        try {
            this.client = new Redis({
                host,
                port,
                password,
                lazyConnect: true,
                maxRetriesPerRequest: 1,
                connectTimeout: 2000,
                retryStrategy: (times) => {
                    if (times > 3) {
                        return null;
                    }
                    return Math.min(times * 500, 2000);
                },
            });

            this.client.on('connect', () => {
                this.isConnected = true;
                this.logger.log(`Connected to Redis cluster at ${host}:${port}`);
            });

            this.client.on('error', (err) => {
                this.isConnected = false;
                this.logger.warn(`Redis connection unavailable: ${err.message}. Using resilient memory fallback.`);
            });

            await this.client.connect().catch((err) => {
                this.isConnected = false;
                this.logger.warn(`Redis lazy connect skipped: ${err.message}. Resilient memory fallback active.`);
            });
        } catch (error: any) {
            this.isConnected = false;
            this.logger.warn(`Redis initialization bypassed: ${error.message}`);
        }
    }

    async onModuleDestroy() {
        if (this.client) {
            try {
                await this.client.quit();
            } catch {
                this.client.disconnect();
            }
        }
    }

    async get<T>(key: string): Promise<T | null> {
        if (this.isConnected && this.client) {
            try {
                const data = await this.client.get(key);
                if (data) {
                    return JSON.parse(data) as T;
                }
                return null;
            } catch {
                return this.getFromMemory<T>(key);
            }
        }
        return this.getFromMemory<T>(key);
    }

    async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
        const serialized = JSON.stringify(value);
        if (this.isConnected && this.client) {
            try {
                if (ttlSeconds && ttlSeconds > 0) {
                    await this.client.set(key, serialized, 'EX', ttlSeconds);
                } else {
                    await this.client.set(key, serialized);
                }
                return;
            } catch {
                this.setInMemory(key, value, ttlSeconds);
                return;
            }
        }
        this.setInMemory(key, value, ttlSeconds);
    }

    async del(key: string): Promise<void> {
        if (this.isConnected && this.client) {
            try {
                await this.client.del(key);
            } catch {}
        }
        this.inMemoryCache.delete(key);
    }

    async isHealthy(): Promise<boolean> {
        if (this.isConnected && this.client) {
            try {
                const res = await this.client.ping();
                return res === 'PONG';
            } catch {
                return false;
            }
        }
        return true;
    }

    private getFromMemory<T>(key: string): T | null {
        const item = this.inMemoryCache.get(key);
        if (!item) {
            return null;
        }
        if (item.expiry && item.expiry < Date.now()) {
            this.inMemoryCache.delete(key);
            return null;
        }
        return item.value as T;
    }

    private setInMemory(key: string, value: any, ttlSeconds?: number): void {
        const expiry = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined;
        this.inMemoryCache.set(key, { value, expiry });
    }
}
