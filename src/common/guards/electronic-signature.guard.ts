import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const REQUIRE_E_SIGNATURE_KEY = 'require_electronic_signature';

export interface ElectronicSignaturePayload {
    signedBy: string;
    reason: string;
    timestamp: string;
    signatureHash: string;
}

@Injectable()
export class ElectronicSignatureGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const isRequired = this.reflector.getAllAndOverride<boolean>(REQUIRE_E_SIGNATURE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!isRequired) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const headerSig = request.headers['x-electronic-signature'];
        const bodySig = request.body?.electronicSignature;

        const rawSig = headerSig || (bodySig ? JSON.stringify(bodySig) : null);

        if (!rawSig) {
            throw new UnauthorizedException(
                '21 CFR Part 11 Electronic Signature required for this high-consequence compliance action',
            );
        }

        try {
            const parsed: ElectronicSignaturePayload = typeof rawSig === 'string' ? JSON.parse(rawSig) : rawSig;

            if (!parsed.signedBy || !parsed.reason || !parsed.signatureHash) {
                throw new BadRequestException(
                    'Invalid Electronic Signature manifest: missing signedBy, reason, or signatureHash',
                );
            }

            request.electronicSignature = parsed;
            return true;
        } catch (err: any) {
            if (err instanceof BadRequestException || err instanceof UnauthorizedException) {
                throw err;
            }
            throw new BadRequestException('Malformed 21 CFR Part 11 Electronic Signature payload');
        }
    }
}

