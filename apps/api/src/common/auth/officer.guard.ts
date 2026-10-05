import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type { RequestWithCaller } from './caller.js';
import { CallerResolver } from './caller.resolver.js';

/** Only a Duty Officer (valid x-officer-key) gets through. */
@Injectable()
export class OfficerGuard implements CanActivate {
  constructor(private readonly callers: CallerResolver) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithCaller>();
    const caller = this.callers.resolve(request.headers);

    if (caller?.kind !== 'officer') {
      throw new UnauthorizedException('Officer key required');
    }
    request.caller = caller;
    return true;
  }
}
