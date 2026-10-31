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
  hash: string;
}

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ComplianceAudit');
  private static readonly records: AuditRecord[] = [];

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

  static clearAuditRecords(): void {
    AuditLoggingInterceptor.records.length = 0;
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
          const hash = createHash('sha256')
            .update(`${timestamp}:${method}:${originalUrl}:${statusCode}:${callerId}`)
            .digest('hex');

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
          const hash = createHash('sha256')
            .update(`${timestamp}:${method}:${originalUrl}:${statusCode}:${callerId}:ERR`)
            .digest('hex');

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
