import { Prisma } from '@prisma/client';
import type { HazardReport as HazardReportRow } from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { NewHazardReport } from '../hazard-report.repository.js';
import { PrismaHazardReportRepository } from './prisma-hazard-report.repository.js';

const ID = '665f1f77bcf86cd799439011';

const input: NewHazardReport = {
  reporterId: 'reporter-1',
  clientRequestId: 'client-1',
  type: 'FLOOD',
  description: 'Water is rising near the bridge',
  location: { latitude: 7.2906, longitude: 80.6337 },
  photos: [],
};

function row(overrides: Partial<HazardReportRow> = {}): HazardReportRow {
  return {
    id: ID,
    reference: 'HR-2026-0001',
    reporterId: 'reporter-1',
    clientRequestId: 'client-1',
    reporterName: null,
    reporterContact: null,
    type: 'FLOOD',
    description: 'Water is rising near the bridge',
    location: { latitude: 7.2906, longitude: 80.6337 },
    photos: [],
    status: 'PENDING_VERIFICATION',
    decidedAt: null,
    decidedBy: null,
    officerNotes: null,
    rejectionReason: null,
    rejectionDetails: null,
    createdAt: new Date('2026-10-05T06:35:00.000Z'),
    updatedAt: new Date('2026-10-05T06:35:00.000Z'),
    ...overrides,
  };
}

function uniqueViolation(target: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

function createPrismaMock() {
  return {
    hazardReport: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    counter: { upsert: vi.fn() },
  };
}

describe('PrismaHazardReportRepository', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let repository: PrismaHazardReportRepository;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'));
    prisma = createPrismaMock();
    prisma.counter.upsert.mockResolvedValue({ id: 'HR-2026', seq: 1 });
    repository = new PrismaHazardReportRepository(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    it('stores the report with a year-based reference', async () => {
      prisma.counter.upsert.mockResolvedValue({ id: 'HR-2026', seq: 42 });
      prisma.hazardReport.create.mockResolvedValue(
        row({ reference: 'HR-2026-0042' }),
      );

      const result = await repository.create(input);

      expect(prisma.counter.upsert).toHaveBeenCalledWith({
        where: { id: 'HR-2026' },
        create: { id: 'HR-2026', seq: 1 },
        update: { seq: { increment: 1 } },
      });
      expect(prisma.hazardReport.create).toHaveBeenCalledWith({
        data: { ...input, reference: 'HR-2026-0042' },
      });
      expect(result.created).toBe(true);
      expect(result.report.reference).toBe('HR-2026-0042');
    });

    it('pads the sequence to four digits', async () => {
      prisma.hazardReport.create.mockResolvedValue(row());

      await repository.create(input);

      expect(prisma.hazardReport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ reference: 'HR-2026-0001' }),
      });
    });

    it('returns the existing report when the clientRequestId is replayed', async () => {
      prisma.hazardReport.create.mockRejectedValue(
        uniqueViolation('hazard_reports_clientRequestId_key'),
      );
      prisma.hazardReport.findUnique.mockResolvedValue(row());

      const result = await repository.create(input);

      expect(result.created).toBe(false);
      expect(prisma.hazardReport.findUnique).toHaveBeenCalledWith({
        where: { clientRequestId: 'client-1' },
      });
    });

    it('rethrows a unique violation on any other field', async () => {
      const error = uniqueViolation('hazard_reports_reference_key');
      prisma.hazardReport.create.mockRejectedValue(error);

      await expect(repository.create(input)).rejects.toBe(error);
    });

    it('rethrows when the replayed report cannot be found', async () => {
      const error = uniqueViolation('hazard_reports_clientRequestId_key');
      prisma.hazardReport.create.mockRejectedValue(error);
      prisma.hazardReport.findUnique.mockResolvedValue(null);

      await expect(repository.create(input)).rejects.toBe(error);
    });

    it('rethrows unexpected database errors', async () => {
      prisma.hazardReport.create.mockRejectedValue(
        new Error('connection lost'),
      );

      await expect(repository.create(input)).rejects.toThrow('connection lost');
    });

    it('retries once when two requests race to create the year counter', async () => {
      prisma.counter.upsert
        .mockRejectedValueOnce(uniqueViolation('counters._id'))
        .mockResolvedValueOnce({ id: 'HR-2026', seq: 2 });
      prisma.hazardReport.create.mockResolvedValue(row());

      await repository.create(input);

      expect(prisma.counter.upsert).toHaveBeenCalledTimes(2);
    });

    it('gives up if the counter keeps failing', async () => {
      prisma.counter.upsert.mockRejectedValue(uniqueViolation('counters._id'));

      await expect(repository.create(input)).rejects.toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError,
      );
      expect(prisma.counter.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.hazardReport.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('maps a stored row to an entity', async () => {
      prisma.hazardReport.findUnique.mockResolvedValue(
        row({
          reporterName: 'Nimal',
          status: 'REJECTED',
          decidedAt: new Date('2026-10-05T07:00:00.000Z'),
          decidedBy: 'officer-1',
          rejectionReason: 'DUPLICATE',
        }),
      );

      const report = await repository.findById(ID);

      expect(report?.reporterName).toBe('Nimal');
      expect(report?.reporterContact).toBeUndefined();
      expect(report?.decision).toEqual({
        decidedAt: new Date('2026-10-05T07:00:00.000Z'),
        decidedBy: 'officer-1',
        officerNotes: undefined,
        rejectionReason: 'DUPLICATE',
        rejectionDetails: undefined,
      });
    });

    it('returns null for an unknown id', async () => {
      prisma.hazardReport.findUnique.mockResolvedValue(null);

      expect(await repository.findById(ID)).toBeNull();
    });

    it('returns null for a malformed id without querying', async () => {
      expect(await repository.findById('not-an-object-id')).toBeNull();
      expect(prisma.hazardReport.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findByClientRequestId', () => {
    it('returns null when nothing matches', async () => {
      prisma.hazardReport.findUnique.mockResolvedValue(null);

      expect(await repository.findByClientRequestId('missing')).toBeNull();
    });
  });

  describe('findByReporter', () => {
    it('returns newest first and caps the result', async () => {
      prisma.hazardReport.findMany.mockResolvedValue([row(), row()]);

      const reports = await repository.findByReporter('reporter-1', 10);

      expect(reports).toHaveLength(2);
      expect(prisma.hazardReport.findMany).toHaveBeenCalledWith({
        where: { reporterId: 'reporter-1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 10,
      });
    });

    it('defaults to a limit of 100', async () => {
      prisma.hazardReport.findMany.mockResolvedValue([]);

      await repository.findByReporter('reporter-1');

      expect(prisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('list', () => {
    it('applies filters, sort order, and pagination', async () => {
      prisma.hazardReport.findMany.mockResolvedValue([row()]);
      prisma.hazardReport.count.mockResolvedValue(12);

      const page = await repository.list({
        status: 'PENDING_VERIFICATION',
        type: 'LANDSLIDE',
        sort: 'oldest',
        page: 3,
        limit: 5,
      });

      const where = { status: 'PENDING_VERIFICATION', type: 'LANDSLIDE' };
      expect(prisma.hazardReport.findMany).toHaveBeenCalledWith({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: 10,
        take: 5,
      });
      expect(prisma.hazardReport.count).toHaveBeenCalledWith({ where });
      expect(page).toMatchObject({ total: 12, page: 3, limit: 5 });
      expect(page.items).toHaveLength(1);
    });

    it('sorts newest first and filters nothing by default', async () => {
      prisma.hazardReport.findMany.mockResolvedValue([]);
      prisma.hazardReport.count.mockResolvedValue(0);

      const page = await repository.list({
        sort: 'newest',
        page: 1,
        limit: 20,
      });

      expect(prisma.hazardReport.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: 0,
        take: 20,
      });
      expect(page.items).toEqual([]);
    });
  });

  describe('stats', () => {
    it('counts each bucket and the total', async () => {
      prisma.hazardReport.count
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(24)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(136);
      const since = new Date('2026-10-04T18:30:00.000Z');

      const stats = await repository.stats(since);

      expect(stats).toEqual({
        pending: 12,
        verifiedToday: 24,
        rejected: 7,
        total: 136,
      });
      expect(prisma.hazardReport.count).toHaveBeenCalledWith({
        where: { status: 'VERIFIED', decidedAt: { gte: since } },
      });
    });
  });

  describe('decide', () => {
    const verify = { status: 'VERIFIED', decidedBy: 'officer-1' } as const;

    it('verifies a pending report', async () => {
      prisma.hazardReport.updateMany.mockResolvedValue({ count: 1 });
      prisma.hazardReport.findUnique.mockResolvedValue(
        row({
          status: 'VERIFIED',
          decidedAt: new Date('2026-10-05T10:00:00.000Z'),
          decidedBy: 'officer-1',
        }),
      );

      const result = await repository.decide(ID, verify);

      expect(prisma.hazardReport.updateMany).toHaveBeenCalledWith({
        where: { id: ID, status: 'PENDING_VERIFICATION' },
        data: expect.objectContaining({
          status: 'VERIFIED',
          decidedBy: 'officer-1',
          decidedAt: new Date('2026-10-05T10:00:00.000Z'),
        }),
      });
      expect(result).toMatchObject({
        outcome: 'DECIDED',
        report: { status: 'VERIFIED' },
      });
    });

    it('records the reason when rejecting', async () => {
      prisma.hazardReport.updateMany.mockResolvedValue({ count: 1 });
      prisma.hazardReport.findUnique.mockResolvedValue(
        row({ status: 'REJECTED' }),
      );

      await repository.decide(ID, {
        status: 'REJECTED',
        decidedBy: 'officer-1',
        rejectionReason: 'OTHER',
        rejectionDetails: 'Different location',
        officerNotes: 'Checked the map',
      });

      expect(prisma.hazardReport.updateMany).toHaveBeenCalledWith({
        where: { id: ID, status: 'PENDING_VERIFICATION' },
        data: expect.objectContaining({
          status: 'REJECTED',
          rejectionReason: 'OTHER',
          rejectionDetails: 'Different location',
          officerNotes: 'Checked the map',
        }),
      });
    });

    it('reports ALREADY_DECIDED when no pending report matched', async () => {
      prisma.hazardReport.updateMany.mockResolvedValue({ count: 0 });
      prisma.hazardReport.findUnique.mockResolvedValue(
        row({ status: 'VERIFIED' }),
      );

      expect(await repository.decide(ID, verify)).toEqual({
        outcome: 'ALREADY_DECIDED',
      });
    });

    it('reports NOT_FOUND for an unknown id', async () => {
      prisma.hazardReport.updateMany.mockResolvedValue({ count: 0 });
      prisma.hazardReport.findUnique.mockResolvedValue(null);

      expect(await repository.decide(ID, verify)).toEqual({
        outcome: 'NOT_FOUND',
      });
    });

    it('reports NOT_FOUND for a malformed id without touching the database', async () => {
      expect(await repository.decide('nope', verify)).toEqual({
        outcome: 'NOT_FOUND',
      });
      expect(prisma.hazardReport.updateMany).not.toHaveBeenCalled();
    });
  });
});
