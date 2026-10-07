import { Prisma } from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service.js';
import {
  channel,
  hoursFromNow,
  NOW,
  OTHER_WARNING_ID,
  WARNING_ID,
  warningEntity,
} from '../testing/fixtures.js';
import { PrismaHazardWarningRepository } from './prisma-hazard-warning.repository.js';

/** A stored row as Prisma returns it: nulls, not undefined. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: WARNING_ID,
    reference: 'HW-2026-0001',
    clientRequestId: '7b0e6c0e-0f5e-4a52-9a77-3d3a0c1f9a11',
    hazardType: 'FLOOD',
    level: 'HIGH',
    description: 'Heavy rainfall expected. Evacuate low-lying areas.',
    additionalInfo: null,
    safetyInstructions: ['Move to higher ground immediately'],
    districts: ['COLOMBO', 'GAMPAHA'],
    validFrom: NOW,
    validUntil: hoursFromNow(12),
    sourceReportId: null,
    status: 'DRAFT',
    channels: [],
    createdBy: 'Officer Silva',
    issuedBy: null,
    issuedAt: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function fakePrisma() {
  return {
    counter: { upsert: vi.fn().mockResolvedValue({ id: 'HW-2026', seq: 1 }) },
    hazardWarning: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

describe('PrismaHazardWarningRepository', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let repository: PrismaHazardWarningRepository;

  beforeEach(() => {
    prisma = fakePrisma();
    repository = new PrismaHazardWarningRepository(
      prisma as unknown as PrismaService,
    );
  });

  describe('create', () => {
    const input = {
      ...warningEntity(),
      createdBy: 'Officer Silva',
      status: 'DRAFT' as const,
      channels: [],
    };

    it('stores the warning with a fresh HW reference', async () => {
      prisma.hazardWarning.create.mockResolvedValue(row());

      const result = await repository.create(input);

      expect(result.created).toBe(true);
      expect(result.warning.additionalInfo).toBeUndefined();
      expect(prisma.hazardWarning.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reference: expect.stringMatching(/^HW-\d{4}-0001$/),
          status: 'DRAFT',
        }),
      });
    });

    it('returns the stored warning when the clientRequestId was already used', async () => {
      prisma.hazardWarning.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup clientRequestId', {
          code: 'P2002',
          clientVersion: '6.19.3',
          meta: { target: 'clientRequestId' },
        }),
      );
      prisma.hazardWarning.findUnique.mockResolvedValue(row());

      const result = await repository.create(input);

      expect(result).toEqual({
        warning: expect.objectContaining({ id: WARNING_ID }),
        created: false,
      });
    });
  });

  it('treats a malformed id as not found without querying', async () => {
    await expect(repository.findById('not-an-id')).resolves.toBeNull();
    await expect(
      repository.cancel('nope', {
        cancelledBy: 'x',
        reason: 'y',
        cancelledAt: NOW,
      }),
    ).resolves.toEqual({
      outcome: 'NOT_FOUND',
    });
    expect(prisma.hazardWarning.findUnique).not.toHaveBeenCalled();
  });

  it('maps the cancellation and channels of a stored row', async () => {
    prisma.hazardWarning.findUnique.mockResolvedValue(
      row({
        status: 'CANCELLED',
        cancelledAt: NOW,
        cancelledBy: 'Officer Silva',
        cancelReason: 'Water receded',
        channels: [{ ...channel('SMS'), lastError: null, sentAt: null }],
      }),
    );

    const warning = await repository.findById(WARNING_ID);

    expect(warning?.cancellation).toEqual({
      cancelledAt: NOW,
      cancelledBy: 'Officer Silva',
      reason: 'Water receded',
    });
    expect(warning?.channels[0]).toEqual({
      ...channel('SMS'),
      lastError: undefined,
      sentAt: undefined,
    });
  });

  describe('conditional transitions', () => {
    it('updates a draft only while it is a draft, clearing removed fields', async () => {
      prisma.hazardWarning.updateMany.mockResolvedValue({ count: 1 });
      prisma.hazardWarning.findUnique.mockResolvedValue(row());

      const result = await repository.updateDraft(WARNING_ID, {
        ...warningEntity(),
        description: undefined,
      });

      expect(result.outcome).toBe('UPDATED');
      expect(prisma.hazardWarning.updateMany).toHaveBeenCalledWith({
        where: { id: WARNING_ID, status: { in: ['DRAFT'] } },
        data: expect.objectContaining({ description: null }),
      });
    });

    it('reports WRONG_STATE with the current warning when no row matched', async () => {
      prisma.hazardWarning.updateMany.mockResolvedValue({ count: 0 });
      prisma.hazardWarning.findUnique.mockResolvedValue(
        row({ status: 'CANCELLED' }),
      );

      const result = await repository.cancel(WARNING_ID, {
        cancelledBy: 'Officer Silva',
        reason: 'Done',
        cancelledAt: NOW,
      });

      expect(result).toEqual({
        outcome: 'WRONG_STATE',
        warning: expect.objectContaining({ status: 'CANCELLED' }),
      });
      expect(prisma.hazardWarning.updateMany).toHaveBeenCalledWith({
        where: {
          id: WARNING_ID,
          status: {
            in: [
              'DISSEMINATING',
              'DISSEMINATED',
              'PARTIALLY_DISSEMINATED',
              'PENDING_DISSEMINATION',
            ],
          },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: NOW,
          cancelledBy: 'Officer Silva',
          cancelReason: 'Done',
        },
      });
    });

    it('reports NOT_FOUND when the row is gone', async () => {
      prisma.hazardWarning.updateMany.mockResolvedValue({ count: 0 });
      prisma.hazardWarning.findUnique.mockResolvedValue(null);

      await expect(
        repository.startDissemination(WARNING_ID, ['DRAFT'], {}),
      ).resolves.toEqual({ outcome: 'NOT_FOUND' });
    });

    it('starts dissemination with the issue details and fresh channels', async () => {
      prisma.hazardWarning.updateMany.mockResolvedValue({ count: 1 });
      prisma.hazardWarning.findUnique.mockResolvedValue(
        row({ status: 'DISSEMINATING' }),
      );

      await repository.startDissemination(WARNING_ID, ['DRAFT'], {
        issuedBy: 'Officer Silva',
        issuedAt: NOW,
        validFrom: NOW,
        channels: [channel('PUSH', { state: 'PENDING' })],
      });

      expect(prisma.hazardWarning.updateMany).toHaveBeenCalledWith({
        where: { id: WARNING_ID, status: { in: ['DRAFT'] } },
        data: {
          status: 'DISSEMINATING',
          issuedBy: 'Officer Silva',
          issuedAt: NOW,
          validFrom: NOW,
          channels: {
            set: [
              expect.objectContaining({ channel: 'PUSH', state: 'PENDING' }),
            ],
          },
        },
      });
    });

    it('records dissemination only while still disseminating, and returns the row', async () => {
      prisma.hazardWarning.updateMany.mockResolvedValue({ count: 1 });
      prisma.hazardWarning.findUnique.mockResolvedValue(
        row({ status: 'DISSEMINATED' }),
      );

      const warning = await repository.recordDissemination(
        WARNING_ID,
        [channel('PUSH')],
        'DISSEMINATED',
      );

      expect(warning.status).toBe('DISSEMINATED');
      expect(prisma.hazardWarning.updateMany).toHaveBeenCalledWith({
        where: { id: WARNING_ID, status: 'DISSEMINATING' },
        data: {
          status: 'DISSEMINATED',
          channels: { set: [expect.objectContaining({ channel: 'PUSH' })] },
        },
      });
    });
  });

  it('deletes only drafts', async () => {
    prisma.hazardWarning.deleteMany.mockResolvedValueOnce({ count: 1 });
    await expect(repository.deleteDraft(WARNING_ID)).resolves.toBe('DELETED');

    prisma.hazardWarning.deleteMany.mockResolvedValueOnce({ count: 0 });
    prisma.hazardWarning.findUnique.mockResolvedValueOnce(
      row({ status: 'DISSEMINATED' }),
    );
    await expect(repository.deleteDraft(WARNING_ID)).resolves.toBe('NOT_DRAFT');

    prisma.hazardWarning.deleteMany.mockResolvedValueOnce({ count: 0 });
    prisma.hazardWarning.findUnique.mockResolvedValueOnce(null);
    await expect(repository.deleteDraft(WARNING_ID)).resolves.toBe('NOT_FOUND');
  });

  it('finds active warnings for the same hazard in any shared district', async () => {
    prisma.hazardWarning.findMany.mockResolvedValue([
      row({ id: OTHER_WARNING_ID, status: 'DISSEMINATED' }),
    ]);

    const found = await repository.findActiveOverlapping({
      hazardType: 'FLOOD',
      districts: ['COLOMBO'],
      now: NOW,
      excludeId: WARNING_ID,
    });

    expect(found).toHaveLength(1);
    expect(prisma.hazardWarning.findMany).toHaveBeenCalledWith({
      where: {
        hazardType: 'FLOOD',
        districts: { hasSome: ['COLOMBO'] },
        status: {
          in: [
            'DISSEMINATING',
            'DISSEMINATED',
            'PARTIALLY_DISSEMINATED',
            'PENDING_DISSEMINATION',
          ],
        },
        validUntil: { gt: NOW },
        id: { not: WARNING_ID },
      },
      orderBy: { issuedAt: 'desc' },
    });
  });

  it.each([
    ['active', { status: { in: expect.any(Array) }, validUntil: { gt: NOW } }],
    ['drafts', { status: 'DRAFT' }],
    [
      'past',
      {
        OR: [
          { status: 'CANCELLED' },
          { status: { in: expect.any(Array) }, validUntil: { lte: NOW } },
        ],
      },
    ],
  ] as const)('lists the %s view with paging', async (view, where) => {
    prisma.hazardWarning.findMany.mockResolvedValue([row()]);
    prisma.hazardWarning.count.mockResolvedValue(21);

    const page = await repository.list({ view, page: 2, limit: 20, now: NOW });

    expect(page).toEqual({
      items: [expect.any(Object)],
      total: 21,
      page: 2,
      limit: 20,
    });
    expect(prisma.hazardWarning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 20, take: 20 }),
    );
  });

  it('counts active, drafts and issued today', async () => {
    prisma.hazardWarning.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);

    await expect(repository.stats(NOW, hoursFromNow(-8))).resolves.toEqual({
      active: 2,
      drafts: 1,
      issuedToday: 3,
    });
  });

  it('finds several warnings by id, ignoring malformed ids', async () => {
    prisma.hazardWarning.findMany.mockResolvedValue([row()]);

    await repository.findByIds([WARNING_ID, 'bad']);

    expect(prisma.hazardWarning.findMany).toHaveBeenCalledWith({
      where: { id: { in: [WARNING_ID] } },
    });
  });
});
