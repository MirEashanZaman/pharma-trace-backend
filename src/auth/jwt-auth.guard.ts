import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Optional } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(@Optional() private readonly redisService?: RedisService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        if (!req || !req.headers) {
            return true;
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or invalid bearer token');
        }

        const token = authHeader.slice(7).trim();
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new UnauthorizedException('Malformed token structure');
            }
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (payload.exp && Date.now() >= payload.exp * 1000) {
                throw new UnauthorizedException('Token has expired');
            }
            const rawUserId = payload.userId ?? payload.sub ?? payload.id;
            const parsedUserId = rawUserId ? Number(rawUserId) : undefined;

            if (this.redisService) {
                const isBlacklisted = await this.redisService.get<boolean>(`blacklist:token:${token}`);
                if (isBlacklisted) {
                    throw new UnauthorizedException('Session token has been revoked. Please sign in again.');
                }
                if (parsedUserId) {
                    const isDisabled = await this.redisService.get<boolean>(`user:disabled:${parsedUserId}`);
                    if (isDisabled) {
                        throw new UnauthorizedException('This account has been temporarily disabled by an administrator.');
                    }
                }
            }

            req.user = {
                ...payload,
                userId: parsedUserId,
                id: parsedUserId,
            };
            return true;
        } catch (err: any) {
            throw new UnauthorizedException(err.message || 'Unauthorized token');
        }
    }
}
