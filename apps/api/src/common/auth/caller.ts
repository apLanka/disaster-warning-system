import { createHash, timingSafeEqual } from 'node:crypto';

import type { Request } from 'express';

export const OFFICER_KEY_HEADER = 'x-officer-key';
export const OFFICER_NAME_HEADER = 'x-officer-name';

export const DEFAULT_OFFICER_NAME = 'Duty Officer';
const MAX_OFFICER_NAME_LENGTH = 100;

export type Caller =
  { kind: 'officer'; name: string } | { kind: 'reporter'; reporterId: string };

export type RequestWithCaller = Request & { caller?: Caller };

/** Compares digests so the check takes the same time wherever the keys differ. */
export function keysMatch(provided: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

export function readOfficerName(header: string | string[] | undefined): string {
  const name = typeof header === 'string' ? header.trim() : '';
  return name === ''
    ? DEFAULT_OFFICER_NAME
    : name.slice(0, MAX_OFFICER_NAME_LENGTH);
}

/** OfficerGuard guarantees an officer; this narrows the type for the compiler. */
export function officerNameOf(caller: Caller): string {
  if (caller.kind !== 'officer') {
    throw new Error('Officer route reached by a non-officer');
  }
  return caller.name;
}
