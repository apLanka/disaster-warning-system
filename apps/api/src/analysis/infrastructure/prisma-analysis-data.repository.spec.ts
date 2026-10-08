import type { PrismaService } from '../../prisma/prisma.service.js';
import { PrismaAnalysisDataRepository } from './prisma-analysis-data.repository.js';

const ID = '665f1f77bcf86cd799439011';
const at = new Date('2026-03-10T04:00:00.000Z');

function build() {
  const prisma = {
    disasterEvent: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    eventWarning: { findMany: vi.fn() },
    shelter: { findMany: vi.fn() },
    shelterOccupancyRecord: { findMany: vi.fn() },
    resourceDistribution: { findMany: vi.fn() },
    resource: { findMany: vi.fn() },
    organisation: { findMany: vi.fn() },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return {
    prisma,
    repo: new PrismaAnalysisDataRepository(prisma as unknown as PrismaService),
  };
}

const eventRow = {
  id: ID,
  eventId: 'DE-2026-0001',
  name: 'Kelani River Flood',
  hazardType: 'FLOOD',
  districtCodes: ['CMB'],
  startedAt: at,
  endedAt: at,
  status: 'COMPLETED',
  isDemoData: true,
  updatedAt: at,
};

describe('PrismaAnalysisDataRepository', () => {
  it('lists completed events with filters, paging and a case-insensitive search', async () => {
    const { prisma, repo } = build();
    prisma.disasterEvent.findMany.mockResolvedValue([eventRow]);
    prisma.disasterEvent.count.mockResolvedValue(11);

    const page = await repo.findCompletedEvents({
      search: ' kelani ',
      hazardType: 'FLOOD',
      district: 'CMB',
      page: 3,
      limit: 5,
    });

    expect(page).toEqual({ items: [eventRow], total: 11 });
    const args = prisma.disasterEvent.findMany.mock.calls[0]![0];
    expect(args.where).toEqual({
      status: 'COMPLETED',
      hazardType: 'FLOOD',
      districtCodes: { has: 'CMB' },
      OR: [
        { name: { contains: 'kelani', mode: 'insensitive' } },
        { eventId: { contains: 'kelani', mode: 'insensitive' } },
      ],
    });
    expect(args).toMatchObject({
      skip: 10,
      take: 5,
      orderBy: { endedAt: 'desc' },
    });
    expect(prisma.disasterEvent.count).toHaveBeenCalledWith({
      where: args.where,
    });
  });

  it('applies only the completed filter when nothing else is asked', async () => {
    const { prisma, repo } = build();
    prisma.disasterEvent.findMany.mockResolvedValue([]);
    prisma.disasterEvent.count.mockResolvedValue(0);
    await repo.findCompletedEvents({ page: 1, limit: 10 });
    expect(prisma.disasterEvent.findMany.mock.calls[0]![0].where).toEqual({
      status: 'COMPLETED',
    });
  });

  it('finds an event by id, and returns null without a query for a malformed id', async () => {
    const { prisma, repo } = build();
    prisma.disasterEvent.findUnique.mockResolvedValueOnce(eventRow);
    expect((await repo.findEventById(ID))?.eventId).toBe('DE-2026-0001');
    expect(await repo.findEventById('not-an-id')).toBeNull();
    expect(prisma.disasterEvent.findUnique).toHaveBeenCalledTimes(1);
    prisma.disasterEvent.findUnique.mockResolvedValueOnce(null);
    expect(await repo.findEventById(ID)).toBeNull();
  });

  it('reads warnings in time order and sums the reach', async () => {
    const { prisma, repo } = build();
    prisma.eventWarning.findMany.mockResolvedValue([
      {
        id: 'w1',
        eventId: ID,
        issuedAt: at,
        level: 'HIGH',
        label: 'INITIAL_ALERT',
        title: 't',
        districts: [
          { districtCode: 'CMB', targeted: 100, reached: 80 },
          { districtCode: 'GMP', targeted: 100, reached: 60 },
        ],
      },
    ]);
    expect(await repo.findWarningsByEvent(ID)).toHaveLength(1);
    expect(prisma.eventWarning.findMany).toHaveBeenCalledWith({
      where: { eventId: ID },
      orderBy: { issuedAt: 'asc' },
    });
    expect(await repo.countCitizensReached(ID)).toBe(140);
    expect(await repo.countCitizensReached(ID, ['GMP'])).toBe(60);
  });

  it('reads shelters and occupancy records for the event', async () => {
    const { prisma, repo } = build();
    const shelter = {
      id: 's1',
      eventId: ID,
      name: 'Centre',
      districtCode: 'CMB',
      capacity: 100,
      status: 'OPEN',
    };
    const record = {
      id: 'o1',
      shelterId: 's1',
      eventId: ID,
      occupancyCount: 10,
      recordedAt: at,
      syncStatus: 'SYNCED',
    };
    prisma.shelter.findMany.mockResolvedValue([shelter]);
    prisma.shelterOccupancyRecord.findMany.mockResolvedValue([record]);
    expect(await repo.findSheltersByEvent(ID)).toEqual([shelter]);
    expect(await repo.findShelterOccupancyByEvent(ID)).toEqual([record]);
    expect(prisma.shelterOccupancyRecord.findMany).toHaveBeenCalledWith({
      where: { eventId: ID },
      orderBy: { recordedAt: 'asc' },
    });
  });

  it('joins resource and organisation names, with placeholders when missing', async () => {
    const { prisma, repo } = build();
    const base = {
      eventId: ID,
      districtCode: 'CMB',
      quantity: 5,
      unit: 'packs',
      distributedAt: at,
      syncStatus: 'SYNCED',
    };
    prisma.resourceDistribution.findMany.mockResolvedValue([
      { ...base, id: 'd1', resourceId: 'r1', organisationId: 'g1' },
      { ...base, id: 'd2', resourceId: 'r1', organisationId: 'gone' },
      { ...base, id: 'd3', resourceId: 'gone', organisationId: 'g1' },
    ]);
    prisma.resource.findMany.mockResolvedValue([
      { id: 'r1', resourceName: 'Dry Rations', resourceType: 'FOOD' },
    ]);
    prisma.organisation.findMany.mockResolvedValue([
      { id: 'g1', organisationName: 'Aid Network', organisationType: 'NGO' },
    ]);

    const rows = await repo.findResourceDistributions(ID);

    expect(rows[0]).toMatchObject({
      resourceName: 'Dry Rations',
      resourceType: 'FOOD',
      organisationName: 'Aid Network',
    });
    expect(rows[1]!.organisationName).toBe('Unknown organisation');
    expect(rows[2]).toMatchObject({
      resourceName: 'Unknown resource',
      resourceType: 'OTHER',
    });
    expect(prisma.resource.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['r1', 'gone'] } },
    });
  });
});
