import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IncomingHttpHeaders } from 'node:http';

import type { Env } from '../../config/env.js';
import {
  parseReporterId,
  REPORTER_ID_HEADER,
} from '../decorators/reporter-id.decorator.js';
import {
  keysMatch,
  OFFICER_KEY_HEADER,
  OFFICER_NAME_HEADER,
  readOfficerName,
  type Caller,
} from './caller.js';

/**
 * Works out who is calling from request headers. This is a stand-in for real
 * authentication (login is out of scope): one shared officer key, and a
 * device-generated reporter id.
 */
@Injectable()
export class CallerResolver {
  private readonly officerKey: string;

  constructor(config: ConfigService<Env, true>) {
    this.officerKey = config.get('OFFICER_API_KEY', { infer: true });
  }

  /** Returns null for an anonymous caller. A wrong officer key never falls back to a reporter. */
  resolve(headers: IncomingHttpHeaders): Caller | null {
    const key = headers[OFFICER_KEY_HEADER];
    if (key !== undefined) {
      if (typeof key !== 'string' || !keysMatch(key, this.officerKey)) {
        throw new UnauthorizedException('Invalid officer key');
      }
      return {
        kind: 'officer',
        name: readOfficerName(headers[OFFICER_NAME_HEADER]),
      };
    }

    const reporterId = headers[REPORTER_ID_HEADER];
    if (reporterId !== undefined) {
      return { kind: 'reporter', reporterId: parseReporterId(reporterId) };
    }
    return null;
  }
}
