import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError, TypeORMError } from 'typeorm';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error occurred';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, any>;
        message = body.message || body.error || message;
        error = body.error || error;
      }
    } else if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Database Integrity Violation';
      const driverError = (exception as any).driverError;
      if (driverError?.code === '23505') {
        status = HttpStatus.CONFLICT;
        message = 'A conflicting record with this identifier already exists in the system';
      } else if (driverError?.code === '23503') {
        message = 'Referenced entity does not exist or is constrained by foreign key dependencies';
      } else {
        message = 'Database constraint check failed for the submitted transaction';
      }
      this.logger.error(`Database Exception [${request.method} ${request.url}]: ${exception.message}`);
    } else if (exception instanceof TypeORMError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      error = 'Data Mapping Error';
      message = 'Invalid entity query or parameters encountered during transaction execution';
      this.logger.error(`TypeORM Exception [${request.method} ${request.url}]: ${exception.message}`);
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled Exception [${request.method} ${request.url}]: ${exception.message}`, exception.stack);
      message = process.env.NODE_ENV === 'production' ? 'Internal server error occurred' : exception.message;
    }

    const errorPayload = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
    };

    response.status(status).json(errorPayload);
  }
}

