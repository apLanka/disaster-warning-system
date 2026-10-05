import {
  canRunIntegration,
  createTestPrisma,
} from '../../testing/integration.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { NewHazardReport } from '../hazard-report.repository.js';
import { PrismaHazardReportRepository } from './prisma-hazard-report.repository.js';

function newReport(n: number, overrides: Partial<NewHazardReport> = {}) {
  return {
    reporterId: 'reporter-1',
    clientRequestId: `client-${n}-${Date.now()}`,
    type: 'FLOOD',
    description: `Integration report number ${n}`,
    location: { latitude: 7.29, longitude: 80.63 },
    photos: [],
    ...overrides,
  } satisfies NewHazardReport;
}

describe.skipIf(!canRunIntegration)(
  'PrismaHazardReportRepository (integration, dws_test)',
  () => {
    let prisma: PrismaService;
    let repository: PrismaHazardReportRepository;

    beforeAll(async () => {
      prisma = createTestPrisma();
      await prisma.onModuleInit();
      repository = new PrismaHazardReportRepository(prisma);
    });

    afterAll(async () => {
      await prisma.hazardReport.deleteMany();
      await prisma.counter.deleteMany();
      await prisma.onModuleDestroy();
    });

    beforeEach(async () => {
      await prisma.hazardReport.deleteMany();
      await prisma.counter.deleteMany();
    });

    it('stores a report and hands out sequential references', async () => {
      const first = await repository.create(newReport(1));
      const second = await repository.create(newReport(2));

      const year = new Date().getUTCFullYear();
      expect(first.report.reference).toBe(`HR-${year}-0001`);
      expect(second.report.reference).toBe(`HR-${year}-0002`);
      expect(first.report.status).toBe('PENDING_VERIFICATION');
    });

    it('returns the same report when a clientRequestId is replayed', async () => {
      const input = newReport(1);

      const original = await repository.create(input);
      const replay = await repository.create(input);

      expect(original.created).toBe(true);
      expect(replay.created).toBe(false);
      expect(replay.report.id).toBe(original.report.id);
      expect(await prisma.hazardReport.count()).toBe(1);
    });

    it('creates exactly one report for concurrent replays of one request', async () => {
      const input = newReport(1);

      const results = await Promise.all(
        Array.from({ length: 5 }, () => repository.create(input)),
      );

      expect(results.filter((result) => result.created)).toHaveLength(1);
      expect(new Set(results.map((result) => result.report.id)).size).toBe(1);
    });

    it('lets exactly one of two concurrent decisions win', async () => {
      const { report } = await repository.create(newReport(1));

      const results = await Promise.all([
        repository.decide(report.id, {
          status: 'VERIFIED',
          decidedBy: 'officer-a',
        }),
        repository.decide(report.id, {
          status: 'REJECTED',
          decidedBy: 'officer-b',
          rejectionReason: 'DUPLICATE',
        }),
      ]);

      const outcomes = results.map((result) => result.outcome).sort();
      expect(outcomes).toEqual(['ALREADY_DECIDED', 'DECIDED']);

      const stored = await repository.findById(report.id);
      expect(['VERIFIED', 'REJECTED']).toContain(stored?.status);
    });

    it('refuses a second decision on a decided report', async () => {
      const { report } = await repository.create(newReport(1));
      await repository.decide(report.id, {
        status: 'VERIFIED',
        decidedBy: 'a',
      });

      const second = await repository.decide(report.id, {
        status: 'REJECTED',
        decidedBy: 'b',
        rejectionReason: 'DUPLICATE',
      });

      expect(second.outcome).toBe('ALREADY_DECIDED');
      expect((await repository.findById(report.id))?.status).toBe('VERIFIED');
    });

    it('lists with filters, sort, and pagination, and computes stats', async () => {
      const a = await repository.create(newReport(1, { type: 'FLOOD' }));
      await repository.create(newReport(2, { type: 'LANDSLIDE' }));
      await repository.create(newReport(3, { type: 'FLOOD' }));
      await repository.decide(a.report.id, {
        status: 'VERIFIED',
        decidedBy: 'o',
      });

      const pendingFloods = await repository.list({
        status: 'PENDING_VERIFICATION',
        type: 'FLOOD',
        sort: 'oldest',
        page: 1,
        limit: 10,
      });
      const firstPage = await repository.list({
        sort: 'newest',
        page: 1,
        limit: 2,
      });
      const stats = await repository.stats(new Date(Date.now() - 60_000));

      expect(pendingFloods.total).toBe(1);
      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.total).toBe(3);
      expect(stats).toEqual({
        pending: 2,
        verifiedToday: 1,
        rejected: 0,
        total: 3,
      });
    });
  },
);
