import { Prisma } from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service.js';
import {
  DEVICE_ID,
  NOW,
  OTHER_DEVICE_ID,
  WARNING_ID,
} from '../../hazard-warnings/testing/fixtures.js';
import { PrismaAlertDeliveryRepository } from './prisma-alert-delivery.repository.js';
import { PrismaCitizenDirectory } from './prisma-citizen-directory.js';

function citizenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    deviceId: DEVICE_ID,
    district: 'COLOMBO',
    phone: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function fakePrisma() {
  return {
    citizen: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    alertDelivery: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  };
}

describe('PrismaCitizenDirectory', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let directory: PrismaCitizenDirectory;

  beforeEach(() => {
    prisma = fakePrisma();
    directory = new PrismaCitizenDirectory(prisma as unknown as PrismaService);
  });

  it('registers or moves a citizen, storing a missing phone as null', async () => {
    prisma.citizen.upsert.mockResolvedValue(citizenRow());

    const citizen = await directory.register(DEVICE_ID, 'COLOMBO');

    expect(citizen).toEqual({
      id: 'c1',
      deviceId: DEVICE_ID,
      district: 'COLOMBO',
      phone: undefined,
      updatedAt: NOW,
    });
    expect(prisma.citizen.upsert).toHaveBeenCalledWith({
      where: { deviceId: DEVICE_ID },
      create: { deviceId: DEVICE_ID, district: 'COLOMBO', phone: null },
      update: { district: 'COLOMBO', phone: null },
    });
  });

  it('falls back to an update when two first registrations race', async () => {
    prisma.citizen.upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup deviceId', {
        code: 'P2002',
        clientVersion: '6.19.3',
        meta: { target: 'deviceId' },
      }),
    );
    prisma.citizen.update.mockResolvedValue(citizenRow({ district: 'KANDY' }));

    await expect(directory.register(DEVICE_ID, 'KANDY')).resolves.toMatchObject(
      { district: 'KANDY' },
    );
  });

  it('passes on a failure that is not a registration race', async () => {
    prisma.citizen.upsert.mockRejectedValue(new Error('network'));
    await expect(directory.register(DEVICE_ID, 'KANDY')).rejects.toThrow(
      'network',
    );
    expect(prisma.citizen.update).not.toHaveBeenCalled();
  });

  it('finds a citizen by device, or null', async () => {
    prisma.citizen.findUnique
      .mockResolvedValueOnce(citizenRow())
      .mockResolvedValueOnce(null);
    await expect(directory.findByDeviceId(DEVICE_ID)).resolves.toMatchObject({
      district: 'COLOMBO',
    });
    await expect(directory.findByDeviceId(DEVICE_ID)).resolves.toBeNull();
  });

  it('finds recipients in the districts', async () => {
    prisma.citizen.findMany.mockResolvedValue([
      citizenRow({ phone: '+94771234567' }),
    ]);

    await expect(directory.findInDistricts(['COLOMBO'])).resolves.toEqual([
      { deviceId: DEVICE_ID, district: 'COLOMBO', phone: '+94771234567' },
    ]);
    expect(prisma.citizen.findMany).toHaveBeenCalledWith({
      where: { district: { in: ['COLOMBO'] } },
    });
  });

  it('counts recipients per district and those reachable by SMS', async () => {
    prisma.citizen.groupBy.mockResolvedValue([
      { district: 'COLOMBO', _count: { _all: 3 } },
      { district: 'GAMPAHA', _count: { _all: 2 } },
    ]);
    prisma.citizen.count.mockResolvedValue(4);

    await expect(
      directory.countInDistricts(['COLOMBO', 'GAMPAHA', 'KANDY']),
    ).resolves.toEqual({
      total: 5,
      withPhone: 4,
      byDistrict: { COLOMBO: 3, GAMPAHA: 2, KANDY: 0 },
    });
    expect(prisma.citizen.count).toHaveBeenCalledWith({
      where: {
        district: { in: ['COLOMBO', 'GAMPAHA', 'KANDY'] },
        phone: { not: null },
      },
    });
  });
});

describe('PrismaAlertDeliveryRepository', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let deliveries: PrismaAlertDeliveryRepository;

  beforeEach(() => {
    prisma = fakePrisma();
    deliveries = new PrismaAlertDeliveryRepository(
      prisma as unknown as PrismaService,
    );
  });

  it('creates rows only for devices that do not have the warning yet', async () => {
    prisma.alertDelivery.findMany.mockResolvedValue([{ deviceId: DEVICE_ID }]);
    prisma.alertDelivery.createMany.mockResolvedValue({ count: 1 });

    const count = await deliveries.recordDelivered(WARNING_ID, [
      DEVICE_ID,
      OTHER_DEVICE_ID,
      OTHER_DEVICE_ID,
    ]);

    expect(count).toBe(2);
    expect(prisma.alertDelivery.createMany).toHaveBeenCalledWith({
      data: [
        {
          warningId: WARNING_ID,
          deviceId: OTHER_DEVICE_ID,
          acknowledgedAt: null,
        },
      ],
    });
  });

  it('treats devices a parallel send already delivered to as delivered', async () => {
    prisma.alertDelivery.findMany.mockResolvedValue([]);
    prisma.alertDelivery.createMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '6.19.3',
        meta: { target: 'warningId_deviceId' },
      }),
    );
    await expect(
      deliveries.recordDelivered(WARNING_ID, [DEVICE_ID]),
    ).resolves.toBe(1);
  });

  it('passes on any other write failure, and does nothing for no devices', async () => {
    prisma.alertDelivery.findMany.mockResolvedValue([]);
    prisma.alertDelivery.createMany.mockRejectedValue(new Error('db down'));
    await expect(
      deliveries.recordDelivered(WARNING_ID, [DEVICE_ID]),
    ).rejects.toThrow('db down');
    await expect(deliveries.recordDelivered(WARNING_ID, [])).resolves.toBe(0);
  });

  it('writes nothing when every device already has it', async () => {
    prisma.alertDelivery.findMany.mockResolvedValue([{ deviceId: DEVICE_ID }]);

    await expect(
      deliveries.recordDelivered(WARNING_ID, [DEVICE_ID]),
    ).resolves.toBe(1);
    expect(prisma.alertDelivery.createMany).not.toHaveBeenCalled();
  });

  it('acknowledges once and returns the delivery', async () => {
    prisma.alertDelivery.updateMany.mockResolvedValue({ count: 1 });
    prisma.alertDelivery.findUnique.mockResolvedValue({
      id: 'd1',
      warningId: WARNING_ID,
      deviceId: DEVICE_ID,
      deliveredAt: NOW,
      acknowledgedAt: NOW,
    });

    const result = await deliveries.acknowledge(WARNING_ID, DEVICE_ID, NOW);

    expect(result?.acknowledgedAt).toEqual(NOW);
    expect(prisma.alertDelivery.updateMany).toHaveBeenCalledWith({
      where: {
        warningId: WARNING_ID,
        deviceId: DEVICE_ID,
        acknowledgedAt: null,
      },
      data: { acknowledgedAt: NOW },
    });
  });

  it('returns null for a warning never delivered to the device, or a malformed id', async () => {
    prisma.alertDelivery.updateMany.mockResolvedValue({ count: 0 });
    prisma.alertDelivery.findUnique.mockResolvedValue(null);

    await expect(
      deliveries.acknowledge(WARNING_ID, DEVICE_ID, NOW),
    ).resolves.toBeNull();
    await expect(
      deliveries.acknowledge('bad', DEVICE_ID, NOW),
    ).resolves.toBeNull();
  });

  it('lists a device deliveries newest first and counts acknowledgements', async () => {
    prisma.alertDelivery.findMany.mockResolvedValue([]);
    prisma.alertDelivery.count.mockResolvedValue(3);

    await deliveries.listForDevice(DEVICE_ID, 50);
    expect(prisma.alertDelivery.findMany).toHaveBeenCalledWith({
      where: { deviceId: DEVICE_ID },
      orderBy: { deliveredAt: 'desc' },
      take: 50,
    });
    await expect(deliveries.countAcknowledged(WARNING_ID)).resolves.toBe(3);
    expect(prisma.alertDelivery.count).toHaveBeenCalledWith({
      where: { warningId: WARNING_ID, acknowledgedAt: { not: null } },
    });
  });
});
