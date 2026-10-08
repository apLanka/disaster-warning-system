import {
  canRunIntegration,
  createTestPrisma,
} from '../../testing/integration.js';
import { PrismaAlertDeliveryRepository } from '../../citizens/infrastructure/prisma-alert-delivery.repository.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { initialChannels } from '../domain/warning-rules.js';
import { DEVICE_ID, warningEntity } from '../testing/fixtures.js';
import { PrismaHazardWarningRepository } from './prisma-hazard-warning.repository.js';

describe.skipIf(!canRunIntegration)('warning storage on dws_test', () => {
  let prisma: PrismaService;
  let warnings: PrismaHazardWarningRepository;
  let deliveries: PrismaAlertDeliveryRepository;

  beforeAll(async () => {
    prisma = createTestPrisma();
    await prisma.$connect();
    warnings = new PrismaHazardWarningRepository(prisma);
    deliveries = new PrismaAlertDeliveryRepository(prisma);
  });

  beforeEach(async () => {
    await prisma.alertDelivery.deleteMany();
    await prisma.notificationLog.deleteMany();
    await prisma.hazardWarning.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function issued() {
    const { warning } = await warnings.create({
      ...warningEntity({
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 12 * 3600_000),
      }),
      clientRequestId: crypto.randomUUID(),
      createdBy: 'Officer Silva',
      status: 'DISSEMINATING',
      issuedBy: 'Officer Silva',
      issuedAt: new Date(),
      channels: initialChannels(),
    });
    return warnings.recordDissemination(
      warning.id,
      initialChannels(),
      'DISSEMINATED',
    );
  }

  it('lets exactly one of two concurrent cancels win', async () => {
    const warning = await issued();
    const input = {
      cancelledBy: 'Officer Silva',
      reason: 'Water receded',
      cancelledAt: new Date(),
    };

    const results = await Promise.all([
      warnings.cancel(warning.id, input),
      warnings.cancel(warning.id, input),
    ]);

    expect(
      results.map((r) => r.outcome).sort((a, b) => a.localeCompare(b)),
    ).toEqual(['UPDATED', 'WRONG_STATE']);
  });

  it('returns the first warning when the same clientRequestId is created twice', async () => {
    const input = {
      ...warningEntity(),
      clientRequestId: crypto.randomUUID(),
      createdBy: 'Officer Silva',
      status: 'DRAFT' as const,
      channels: [],
    };
    const [first, second] = await Promise.all([
      warnings.create(input),
      warnings.create(input),
    ]);

    expect(first.warning.id).toBe(second.warning.id);
    expect(
      [first.created, second.created].sort((a, b) => Number(a) - Number(b)),
    ).toEqual([false, true]);
  });

  it('delivers to a device once and acknowledges once', async () => {
    const warning = await issued();

    await deliveries.recordDelivered(warning.id, [DEVICE_ID]);
    await deliveries.recordDelivered(warning.id, [DEVICE_ID]);
    const first = await deliveries.acknowledge(
      warning.id,
      DEVICE_ID,
      new Date('2026-10-07T09:00:00Z'),
    );
    const second = await deliveries.acknowledge(
      warning.id,
      DEVICE_ID,
      new Date('2026-10-07T10:00:00Z'),
    );

    expect(
      await prisma.alertDelivery.count({ where: { warningId: warning.id } }),
    ).toBe(1);
    expect(second?.acknowledgedAt).toEqual(first?.acknowledgedAt);
    expect(await deliveries.countAcknowledged(warning.id)).toBe(1);
  });

  it('finds an overlapping active warning by shared district', async () => {
    const warning = await issued();

    const found = await warnings.findActiveOverlapping({
      hazardType: 'FLOOD',
      districts: ['GAMPAHA', 'KANDY'],
      now: new Date(),
    });

    expect(found.map((w) => w.id)).toEqual([warning.id]);
  });
});
