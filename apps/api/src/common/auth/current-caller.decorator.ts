import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { Caller, RequestWithCaller } from './caller.js';

/** The caller a guard resolved. Only use on routes behind one of the caller guards. */
export const CurrentCaller = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Caller => {
    const { caller } = context.switchToHttp().getRequest<RequestWithCaller>();
    if (!caller)
      throw new Error('CurrentCaller used on a route with no caller guard');
    return caller;
  },
);
