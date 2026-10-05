import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import { CallerResolver } from './caller.resolver.js';

const KEY = 'test-officer-key-0123456789';
const REPORTER = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const config = { get: () => KEY } as unknown as ConfigService<Env, true>;

describe('CallerResolver', () => {
  const resolver = new CallerResolver(config);

  it('recognises an officer by the shared key and takes their name', () => {
    expect(
      resolver.resolve({
        'x-officer-key': KEY,
        'x-officer-name': 'Officer Silva',
      }),
    ).toEqual({ kind: 'officer', name: 'Officer Silva' });
  });

  it('defaults the officer name', () => {
    expect(resolver.resolve({ 'x-officer-key': KEY })).toEqual({
      kind: 'officer',
      name: 'Duty Officer',
    });
  });

  it('recognises a reporter by their device id', () => {
    expect(resolver.resolve({ 'x-reporter-id': REPORTER })).toEqual({
      kind: 'reporter',
      reporterId: REPORTER,
    });
  });

  it('returns null for an anonymous caller', () => {
    expect(resolver.resolve({})).toBeNull();
  });

  it('rejects a wrong officer key', () => {
    expect(() => resolver.resolve({ 'x-officer-key': 'nope' })).toThrow(
      UnauthorizedException,
    );
  });

  it('does not fall back to the reporter id when the officer key is wrong', () => {
    expect(() =>
      resolver.resolve({ 'x-officer-key': 'nope', 'x-reporter-id': REPORTER }),
    ).toThrow(UnauthorizedException);
  });

  it('prefers the officer when both identities are sent', () => {
    expect(
      resolver.resolve({ 'x-officer-key': KEY, 'x-reporter-id': REPORTER }),
    ).toMatchObject({ kind: 'officer' });
  });

  it('rejects a repeated officer key header', () => {
    expect(() =>
      resolver.resolve({ 'x-officer-key': [KEY, KEY] as never }),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a malformed reporter id', () => {
    expect(() => resolver.resolve({ 'x-reporter-id': 'device-1' })).toThrow(
      BadRequestException,
    );
  });
});
