import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import type { ApiErrorBody } from '@repo/types';

const INTERNAL_ERROR_MESSAGE = 'Internal server error';

function statusText(status: number): string {
  const name = HttpStatus[status];
  if (typeof name !== 'string') return 'Error';
  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function messageOf(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string') return body;

  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join('; ');
  if (typeof message === 'string') return message;
  return exception.message;
}

/** Gives every error the same `{ statusCode, error, message }` body. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const body: ApiErrorBody = {
        statusCode,
        error: statusText(statusCode),
        message: messageOf(exception),
      };
      response.status(statusCode).json(body);
      return;
    }

    // Unknown failures are logged in full but never leaked to the client.
    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    const body: ApiErrorBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: statusText(HttpStatus.INTERNAL_SERVER_ERROR),
      message: INTERNAL_ERROR_MESSAGE,
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}
