import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type { RequestWithCaller } from './caller.js';
import { CallerResolver } from './caller.resolver.js';

/** A Duty Officer or a reporter. Which one is left for the handler to act on. */
@Injectable()
export class OfficerOrReporterGuard implements CanActivate {
  constructor(private readonly callers: CallerResolver) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithCaller>();
    const caller = this.callers.resolve(request.headers);

    if (!caller) {
      throw new UnauthorizedException('Officer key or reporter id required');
    }
    request.caller = caller;
    return true;
  }
}
