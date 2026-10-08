import type { PrismaService } from '../../prisma/prisma.service.js';
import {
  canRunIntegration,
  createTestPrisma,
} from '../../testing/integration.js';
import { DisasterAnalysisService } from '../disaster-analysis.service.js';
import type { FakeDataset } from '../domain/analysis.entities.js';
import { buildFakeDataset } from '../fake-data/build-fake-dataset.js';
import { ReportGenerationError } from '../report-generation.error.js';
import { PrismaAnalysisDataRepository } from './prisma-analysis-data.repository.js';

async function wipe(prisma: PrismaService) {
  await prisma.eventWarning.deleteMany();
  await prisma.shelter.deleteMany();
  await prisma.shelterOccupancyRecord.deleteMany();
  await prisma.resourceDistribution.deleteMany();
  await prisma.disasterEvent.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.organisation.deleteMany();
}

async function load(prisma: PrismaService, data: FakeDataset) {
  await prisma.resource.createMany({ data: data.resources });
  await prisma.organisation.createMany({ data: data.organisations });
  await prisma.disasterEvent.createMany({ data: data.events });
  await prisma.eventWarning.createMany({ data: data.warnings });
  await prisma.shelter.createMany({ data: data.shelters });
  await prisma.shelterOccupancyRecord.createMany({
    data: data.occupancyRecords,
  });
  await prisma.resourceDistribution.createMany({ data: data.distributions });
}

describe.skipIf(!canRunIntegration)(
  'PrismaAnalysisDataRepository (integration, dws_test)',
  () => {
    const data = buildFakeDataset();
    const idOf = (eventId: string) =>
      data.events.find((e) => e.eventId === eventId)!.id;
    let prisma: PrismaService;
    let repository: PrismaAnalysisDataRepository;

    beforeAll(async () => {
      prisma = createTestPrisma();
      await prisma.onModuleInit();
      repository = new PrismaAnalysisDataRepository(prisma);
      await wipe(prisma);
      await load(prisma, data);
    });

    afterAll(async () => {
      await wipe(prisma);
      await prisma.onModuleDestroy();
    });

    it('lists the six completed events, newest first, and never the active one', async () => {
      const { items, total } = await repository.findCompletedEvents({
        page: 1,
        limit: 50,
      });
      expect(total).toBe(6);
      expect(items[0]?.eventId).toBe('DE-2026-0006');
      expect(items.map((e) => e.eventId)).not.toContain('DE-2026-0007');
    });

    it('filters by hazard type, district and a case-insensitive search, and pages', async () => {
      const list = (q: object) =>
        repository.findCompletedEvents({ page: 1, limit: 50, ...q });
      expect((await list({ hazardType: 'LANDSLIDE' })).total).toBe(1);
      expect((await list({ district: 'KAN' })).items[0]?.eventId).toBe(
        'DE-2026-0004',
      );
      expect((await list({ search: 'KELANI' })).total).toBe(1);
      expect((await list({ search: 'de-2026-0003' })).total).toBe(1);
      const page2 = await list({ page: 2, limit: 4 });
      expect(page2.items).toHaveLength(2);
      expect(page2.total).toBe(6);
    });

    it('finds an event by id, including an active one, and null otherwise', async () => {
      expect(
        (await repository.findEventById(idOf('DE-2026-0007')))?.status,
      ).toBe('ACTIVE');
      expect(
        await repository.findEventById('000000000000000000000000'),
      ).toBeNull();
      expect(await repository.findEventById('not-an-id')).toBeNull();
    });

    it('reads warnings in time order and sums the reach by district', async () => {
      const id = idOf('DE-2026-0001');
      const warnings = await repository.findWarningsByEvent(id);
      expect(warnings.map((w) => w.label)).toEqual([
        'INITIAL_ALERT',
        'ESCALATION',
        'DISTRICT_UPDATE',
        'FINAL_NOTICE',
      ]);
      const all = await repository.countCitizensReached(id);
      const cmb = await repository.countCitizensReached(id, ['CMB']);
      expect(cmb).toBeGreaterThan(0);
      expect(cmb).toBeLessThan(all);
    });

    it('reads shelters, occupancy records and resource distributions with names joined', async () => {
      const id = idOf('DE-2026-0001');
      expect(await repository.findSheltersByEvent(id)).toHaveLength(6);
      const records = await repository.findShelterOccupancyByEvent(id);
      const times = records.map((r) => r.recordedAt.getTime());
      expect(times).toEqual([...times].sort((a, b) => a - b));
      const rows = await repository.findResourceDistributions(id);
      expect(rows).toHaveLength(9);
      expect(rows.every((r) => r.resourceName && r.organisationName)).toBe(
        true,
      );
      expect(rows.some((r) => r.resourceName === 'Drinking Water')).toBe(true);
    });

    describe('the report, end to end over the real database', () => {
      const service = () => new DisasterAnalysisService(repository);

      it('builds a complete report for event 1, and narrows it to one district', async () => {
        const all = await service().generateDisasterReport(
          idOf('DE-2026-0001'),
        );
        expect(all.dataCompletenessStatus).toBe('COMPLETE');
        expect(all.summary.alertsIssued).toBe(4);
        const one = await service().generateDisasterReport(
          idOf('DE-2026-0001'),
          'CMB',
        );
        expect(one.citizensReached).toBeLessThan(all.citizensReached);
      });

      it('marks event 2 incomplete because of pending records', async () => {
        const report = await service().generateDisasterReport(
          idOf('DE-2026-0002'),
        );
        expect(report.dataStatus.issues.map((i) => i.kind)).toEqual([
          'PENDING_SHELTER_RECORDS',
          'PENDING_RESOURCE_RECORDS',
        ]);
      });

      it('fails for event 6, whose records are inconsistent', async () => {
        await expect(
          service().generateDisasterReport(idOf('DE-2026-0006')),
        ).rejects.toBeInstanceOf(ReportGenerationError);
      });
    });
  },
);
