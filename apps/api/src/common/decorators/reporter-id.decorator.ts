import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

export const REPORTER_ID_HEADER = 'x-reporter-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseReporterId(header: string | string[] | undefined): string {
  if (typeof header !== 'string' || !UUID.test(header)) {
    throw new BadRequestException(
      `${REPORTER_ID_HEADER} header must be a UUID`,
    );
  }
  return header.toLowerCase();
}

/**
 * The citizen's device-generated identity. A stand-in for login, which is out
 * of scope: it groups a device's reports, it does not authenticate anyone.
 */
export const ReporterId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Request>();
    return parseReporterId(request.headers[REPORTER_ID_HEADER]);
  },
);
