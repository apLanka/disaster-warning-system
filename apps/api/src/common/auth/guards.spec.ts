import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import type { RequestWithCaller } from './caller.js';
import { CallerResolver } from './caller.resolver.js';
import { CurrentCaller } from './current-caller.decorator.js';
import { OfficerGuard } from './officer.guard.js';
import { OfficerOrReporterGuard } from './officer-or-reporter.guard.js';

const KEY = 'test-officer-key-0123456789';
const REPORTER = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const resolver = new CallerResolver({
  get: () => KEY,
} as unknown as ConfigService<Env, true>);

function contextFor(headers: Record<string, string>) {
  const request = { headers } as unknown as RequestWithCaller;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { request, context };
}

describe('OfficerGuard', () => {
  const guard = new OfficerGuard(resolver);

  it('lets an officer through and records who they are', () => {
    const { request, context } = contextFor({ 'x-officer-key': KEY });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.caller).toEqual({ kind: 'officer', name: 'Duty Officer' });
  });

  it.each([
    ['no credentials', {}],
    ['only a reporter id', { 'x-reporter-id': REPORTER }],
    ['a wrong key', { 'x-officer-key': 'nope' }],
  ])('turns away %s with a 401', (_name, headers) => {
    const { request, context } = contextFor(headers);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(request.caller).toBeUndefined();
  });
});

describe('OfficerOrReporterGuard', () => {
  const guard = new OfficerOrReporterGuard(resolver);

  it('lets an officer through', () => {
    const { request, context } = contextFor({ 'x-officer-key': KEY });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.caller?.kind).toBe('officer');
  });

  it('lets a reporter through', () => {
    const { request, context } = contextFor({ 'x-reporter-id': REPORTER });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.caller).toEqual({ kind: 'reporter', reporterId: REPORTER });
  });

  it('turns away an anonymous caller with a 401', () => {
    expect(() => guard.canActivate(contextFor({}).context)).toThrow(
      UnauthorizedException,
    );
  });

  it('turns away a wrong officer key even when a reporter id is present', () => {
    const { context } = contextFor({
      'x-officer-key': 'nope',
      'x-reporter-id': REPORTER,
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});

describe('CurrentCaller', () => {
  // createParamDecorator hides its factory, so read it back from Nest's metadata.
  function factory() {
    class Probe {
      handler(@CurrentCaller() _caller: unknown) {}
    }
    const metadata = Reflect.getMetadata(
      '__routeArguments__',
      Probe,
      'handler',
    ) as Record<
      string,
      { factory: (data: unknown, ctx: ExecutionContext) => unknown }
    >;
    return Object.values(metadata)[0]!.factory;
  }

  it('returns the caller a guard resolved', () => {
    const { request, context } = contextFor({});
    request.caller = { kind: 'reporter', reporterId: REPORTER };

    expect(factory()(undefined, context)).toEqual(request.caller);
  });

  it('fails loudly when no guard ran', () => {
    expect(() => factory()(undefined, contextFor({}).context)).toThrow(
      /no caller guard/,
    );
  });
});
