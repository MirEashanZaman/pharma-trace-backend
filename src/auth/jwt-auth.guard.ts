import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();
        if (!req || !req.headers) {
            return true;
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or invalid bearer token');
        }

        const token = authHeader.slice(7);
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new UnauthorizedException('Malformed token structure');
            }
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (payload.exp && Date.now() >= payload.exp * 1000) {
                throw new UnauthorizedException('Token has expired');
            }
            req.user = payload;
            return true;
        } catch (err: any) {
            throw new UnauthorizedException(err.message || 'Unauthorized token');
        }
    }
}
