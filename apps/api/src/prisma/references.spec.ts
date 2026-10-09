import { Prisma } from '@prisma/client';

import type { PrismaService } from './prisma.service.js';
import { isUniqueViolation, nextReference } from './references.js';

function uniqueError(field: string) {
  return new Prisma.PrismaClientKnownRequestError(`Unique on ${field}`, {
    code: 'P2002',
    clientVersion: '6.19.3',
    meta: { target: field },
  });
}

function fakePrisma() {
  return { counter: { upsert: vi.fn() } };
}

describe('isUniqueViolation', () => {
  it('matches a P2002 on the named field only', () => {
    expect(
      isUniqueViolation(uniqueError('clientRequestId'), 'clientRequestId'),
    ).toBe(true);
    expect(isUniqueViolation(uniqueError('reference'), 'clientRequestId')).toBe(
      false,
    );
    expect(isUniqueViolation(new Error('boom'), 'clientRequestId')).toBe(false);
  });
});

describe('nextReference', () => {
  it('formats prefix, year and a zero-padded sequence', async () => {
    const prisma = fakePrisma();
    prisma.counter.upsert.mockResolvedValue({ id: 'HW-2026', seq: 7 });

    const reference = await nextReference(
      prisma as unknown as PrismaService,
      'HW',
      new Date('2026-10-07T00:00:00Z'),
    );

    expect(reference).toBe('HW-2026-0007');
    expect(prisma.counter.upsert).toHaveBeenCalledWith({
      where: { id: 'HW-2026' },
      create: { id: 'HW-2026', seq: 1 },
      update: { seq: { increment: 1 } },
    });
  });

  it('retries once when two first requests race to create the counter', async () => {
    const prisma = fakePrisma();
    prisma.counter.upsert
      .mockRejectedValueOnce(uniqueError('id'))
      .mockResolvedValueOnce({ id: 'HR-2026', seq: 2 });

    await expect(
      nextReference(
        prisma as unknown as PrismaService,
        'HR',
        new Date('2026-01-01T00:00:00Z'),
      ),
    ).resolves.toBe('HR-2026-0002');
  });

  it('gives up after the second failed attempt', async () => {
    const prisma = fakePrisma();
    prisma.counter.upsert.mockRejectedValue(uniqueError('id'));

    await expect(
      nextReference(prisma as unknown as PrismaService, 'HW'),
    ).rejects.toThrow();
    expect(prisma.counter.upsert).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors', async () => {
    const prisma = fakePrisma();
    prisma.counter.upsert.mockRejectedValue(new Error('network'));

    await expect(
      nextReference(prisma as unknown as PrismaService, 'HW'),
    ).rejects.toThrow('network');
    expect(prisma.counter.upsert).toHaveBeenCalledTimes(1);
  });
});
