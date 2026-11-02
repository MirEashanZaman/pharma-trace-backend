import { z } from 'zod';
import { Logger } from '@nestjs/common';

export const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3500),
    DB_HOST: z.string().default('localhost'),
    DB_PORT: z.coerce.number().default(5432),
    DB_USERNAME: z.string().default('postgres'),
    DB_PASSWORD: z.string().default('12345'),
    DB_DATABASE: z.string().default('pharma_trace'),
    DB_SYNCHRONIZE: z.string().optional().default('false'),
    DB_SSL: z.string().optional().default('false'),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    JWT_SECRET: z.string().min(8).default('super-secret-jwt-key-change-in-production'),
    JWT_EXPIRATION: z.string().default('24h'),
    RPC_URL: z.string().optional().default('http://127.0.0.1:8545'),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

export function validateEnvironment(env: Record<string, unknown> = process.env): ValidatedEnv {
    const logger = new Logger('EnvironmentValidator');
    const result = envSchema.safeParse(env);

    if (!result.success) {
        const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        logger.error(`Critical environment variable validation failure: ${errors}`);
        throw new Error(`Environment validation failed: ${errors}`);
    }

    if (result.data.NODE_ENV === 'production' && result.data.JWT_SECRET === 'super-secret-jwt-key-change-in-production') {
        logger.warn('Production environment is operating with default fallback JWT_SECRET. Rotate immediately.');
    }

    return result.data;
}
