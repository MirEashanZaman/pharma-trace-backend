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

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ComplianceAudit');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const user = (req as any).user;
    const callerId = user?.userId ?? user?.id ?? user?.email ?? 'anonymous';
    const callerRole = user?.role ?? 'UNAUTHENTICATED';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode;
          res.setHeader('X-Response-Time', `${duration}ms`);
          this.logger.log(
            `[AUDIT] ${method} ${originalUrl} ${statusCode} +${duration}ms [Caller: ${callerId} | Role: ${callerRole}] [IP: ${ip}]`
          );
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const status = err?.status || err?.statusCode || 500;
          this.logger.warn(
            `[AUDIT_ERROR] ${method} ${originalUrl} ${status} +${duration}ms [Caller: ${callerId} | Role: ${callerRole}] [IP: ${ip}] - ${err?.message}`
          );
        },
      }),
    );
  }
}

