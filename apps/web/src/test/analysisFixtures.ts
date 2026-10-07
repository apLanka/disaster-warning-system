import type {
  DisasterEventDto,
  Paginated,
  PostDisasterReportDto,
} from '@repo/types';

export function event(
  overrides: Partial<DisasterEventDto> = {},
): DisasterEventDto {
  return {
    id: '665f1f77bcf86cd799439011',
    eventId: 'DE-2026-0001',
    name: 'Kelani River Flood',
    hazardType: 'FLOOD',
    districtCodes: ['CMB', 'GMP', 'KAL'],
    startedAt: '2026-03-10T04:00:00.000Z',
    endedAt: '2026-03-12T16:00:00.000Z',
    status: 'COMPLETED',
    isDemoData: true,
    updatedAt: '2026-03-13T04:00:00.000Z',
    ...overrides,
  };
}

export function eventsPage(
  items: DisasterEventDto[],
  overrides: Partial<Paginated<DisasterEventDto>> = {},
): Paginated<DisasterEventDto> {
  return { items, total: items.length, page: 1, limit: 10, ...overrides };
}

/** A complete report for event 1, all districts. */
export function report(
  overrides: Partial<PostDisasterReportDto> = {},
): PostDisasterReportDto {
  return {
    reportId: 'RPT-DE-2026-0001-ALL-1',
    generatedAt: '2026-10-07T10:00:00.000Z',
    event: event(),
    scope: { kind: 'ALL' },
    districtIds: ['CMB', 'GMP', 'KAL'],
    citizensReached: 120_000,
    dataCompletenessStatus: 'COMPLETE',
    dataStatus: { complete: true, issues: [] },
    summary: {
      alertsIssued: 4,
      citizensTargeted: 150_000,
      citizensReached: 120_000,
      reachRate: 0.8,
      peakShelterOccupancy: {
        value: 540,
        at: '2026-03-11T04:00:00.000Z',
        capacity: 900,
      },
      districtsReceivingResources: 3,
    },
    alertTimeline: [
      {
        id: 'w1',
        at: '2026-03-10T04:00:00.000Z',
        level: 'MEDIUM',
        label: 'INITIAL_ALERT',
        title: 'Flood alert issued',
        targeted: 50_000,
        reached: 40_000,
      },
      {
        id: 'w2',
        at: '2026-03-10T10:00:00.000Z',
        level: 'HIGH',
        label: 'ESCALATION',
        title: 'Flood alert escalated',
        targeted: 50_000,
        reached: 42_000,
      },
      {
        id: 'w3',
        at: '2026-03-12T04:00:00.000Z',
        level: 'LOW',
        label: 'FINAL_NOTICE',
        title: 'Situation easing, final notice',
        targeted: 50_000,
        reached: 38_000,
      },
    ],
    shelters: [
      {
        shelterId: 's1',
        name: 'Colombo Relief Centre 1',
        districtCode: 'CMB',
        capacity: 300,
        peakOccupancy: 280,
        latestOccupancy: 40,
        status: 'OPEN',
        pendingRecords: 0,
      },
      {
        shelterId: 's2',
        name: 'Gampaha Relief Centre 1',
        districtCode: 'GMP',
        capacity: 600,
        peakOccupancy: 260,
        latestOccupancy: 0,
        status: 'CLOSED',
        pendingRecords: 1,
      },
    ],
    occupancyTotalSeries: [
      { at: '2026-03-10T10:00:00.000Z', occupancy: 120 },
      { at: '2026-03-11T04:00:00.000Z', occupancy: 540 },
      { at: '2026-03-12T04:00:00.000Z', occupancy: 40 },
    ],
    resources: [
      {
        districtCode: 'CMB',
        resourceName: 'Drinking Water',
        resourceType: 'WATER',
        quantity: 2500,
        unit: 'litres',
        organisationName: 'National Relief Fund',
        syncStatus: 'SYNCED',
      },
      {
        districtCode: 'GMP',
        resourceName: 'Dry Rations',
        resourceType: 'FOOD',
        quantity: 900,
        unit: 'packs',
        organisationName: 'Community Aid Network',
        syncStatus: 'PENDING',
      },
    ],
    resourceTotalsByDistrict: [
      { districtCode: 'CMB', quantity: 2500 },
      { districtCode: 'GMP', quantity: 900 },
    ],
    ...overrides,
  };
}
