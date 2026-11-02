import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { createHash } from 'crypto';

export interface AuditRecord {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  durationMs: number;
  callerId: string;
  callerRole: string;
  clientIp: string;
  status: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
  previousHash: string;
  hash: string;
}

export interface AuditChainIntegrityResult {
  isValid: boolean;
  brokenAtRecordId: string | null;
  totalVerified: number;
  genesisHash: string;
  headHash: string;
}

const GENESIS_AUDIT_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ComplianceAudit');
  private static readonly records: AuditRecord[] = [];
  private static lastHash: string = GENESIS_AUDIT_HASH;

  static getAuditRecords(limit = 100, role?: string, method?: string): AuditRecord[] {
    let list = [...AuditLoggingInterceptor.records];
    if (role) {
      list = list.filter((r) => r.callerRole.toLowerCase() === role.toLowerCase());
    }
    if (method) {
      list = list.filter((r) => r.method.toUpperCase() === method.toUpperCase());
    }
    return list.slice(-limit).reverse();
  }

  static verifyChainIntegrity(): AuditChainIntegrityResult {
    const list = AuditLoggingInterceptor.records;
    if (list.length === 0) {
      return {
        isValid: true,
        brokenAtRecordId: null,
        totalVerified: 0,
        genesisHash: GENESIS_AUDIT_HASH,
        headHash: GENESIS_AUDIT_HASH,
      };
    }

    let expectedPrev = list[0].previousHash;

    for (let i = 0; i < list.length; i++) {
      const rec = list[i];
      if (rec.previousHash !== expectedPrev) {
        return {
          isValid: false,
          brokenAtRecordId: rec.id,
          totalVerified: i,
          genesisHash: GENESIS_AUDIT_HASH,
          headHash: AuditLoggingInterceptor.lastHash,
        };
      }

      const suffix = rec.status === 'ERROR' ? ':ERR' : '';
      const calculated = createHash('sha256')
        .update(`${rec.previousHash}:${rec.timestamp}:${rec.method}:${rec.endpoint}:${rec.statusCode}:${rec.callerId}${suffix}`)
        .digest('hex');

      if (calculated !== rec.hash) {
        return {
          isValid: false,
          brokenAtRecordId: rec.id,
          totalVerified: i,
          genesisHash: GENESIS_AUDIT_HASH,
          headHash: AuditLoggingInterceptor.lastHash,
        };
      }

      expectedPrev = rec.hash;
    }

    return {
      isValid: true,
      brokenAtRecordId: null,
      totalVerified: list.length,
      genesisHash: GENESIS_AUDIT_HASH,
      headHash: AuditLoggingInterceptor.lastHash,
    };
  }

  static clearAuditRecords(): void {
    AuditLoggingInterceptor.records.length = 0;
    AuditLoggingInterceptor.lastHash = GENESIS_AUDIT_HASH;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const user = (req as any).user;
    const callerId = String(user?.userId ?? user?.id ?? user?.email ?? 'anonymous');
    const callerRole = String(user?.role ?? 'UNAUTHENTICATED');

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode;
          res.setHeader('X-Response-Time', `${duration}ms`);
          const timestamp = new Date().toISOString();
          const prev = AuditLoggingInterceptor.lastHash;
          const hash = createHash('sha256')
            .update(`${prev}:${timestamp}:${method}:${originalUrl}:${statusCode}:${callerId}`)
            .digest('hex');
          AuditLoggingInterceptor.lastHash = hash;

          const record: AuditRecord = {
            id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp,
            method,
            endpoint: originalUrl,
            statusCode,
            durationMs: duration,
            callerId,
            callerRole,
            clientIp: ip || '127.0.0.1',
            status: 'SUCCESS',
            previousHash: prev,
            hash,
          };

          AuditLoggingInterceptor.records.push(record);
          if (AuditLoggingInterceptor.records.length > 500) {
            AuditLoggingInterceptor.records.shift();
          }

          this.logger.log(
            `[AUDIT] ${method} ${originalUrl} ${statusCode} +${duration}ms [Caller: ${callerId} | Role: ${callerRole}] [IP: ${ip}]`
          );
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const statusCode = err?.status || err?.statusCode || 500;
          const timestamp = new Date().toISOString();
          const prev = AuditLoggingInterceptor.lastHash;
          const hash = createHash('sha256')
            .update(`${prev}:${timestamp}:${method}:${originalUrl}:${statusCode}:${callerId}:ERR`)
            .digest('hex');
          AuditLoggingInterceptor.lastHash = hash;

          const record: AuditRecord = {
            id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp,
            method,
            endpoint: originalUrl,
            statusCode,
            durationMs: duration,
            callerId,
            callerRole,
            clientIp: ip || '127.0.0.1',
            status: 'ERROR',
            errorMessage: err?.message || 'Execution error',
            previousHash: prev,
            hash,
          };

          AuditLoggingInterceptor.records.push(record);
          if (AuditLoggingInterceptor.records.length > 500) {
            AuditLoggingInterceptor.records.shift();
          }

          this.logger.warn(
            `[AUDIT_ERROR] ${method} ${originalUrl} ${statusCode} +${duration}ms [Caller: ${callerId} | Role: ${callerRole}] [IP: ${ip}] - ${err?.message}`
          );
        },
      }),
    );
  }
}
