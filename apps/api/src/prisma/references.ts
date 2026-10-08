import { Prisma } from '@prisma/client';

import type { PrismaService } from './prisma.service.js';

const REFERENCE_ATTEMPTS = 2;

export function isUniqueViolation(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    `${JSON.stringify(error.meta ?? {})} ${error.message}`.includes(field)
  );
}

/** Hands out <prefix>-<year>-<0001...> from one atomic counter per prefix and year. */
export async function nextReference(
  prisma: PrismaService,
  prefix: 'HR' | 'HW',
  now = new Date(),
): Promise<string> {
  const key = `${prefix}-${now.getUTCFullYear()}`;

  for (let attempt = 1; ; attempt++) {
    try {
      const counter = await prisma.counter.upsert({
        where: { id: key },
        create: { id: key, seq: 1 },
        update: { seq: { increment: 1 } },
      });
      return `${key}-${String(counter.seq).padStart(4, '0')}`;
    } catch (error) {
      // Two first-ever requests can race to create the counter row.
      const lostCreateRace = isUniqueViolation(error, 'id');
      if (!lostCreateRace || attempt >= REFERENCE_ATTEMPTS) throw error;
    }
  }
}
