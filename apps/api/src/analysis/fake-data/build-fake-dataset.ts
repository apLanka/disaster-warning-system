import type {
  AlertLabel,
  AlertLevel,
  DistrictCode,
  EventStatus,
  HazardType,
  ResourceType,
  SyncStatus,
} from '@repo/types';
import { districtName } from '@repo/types';
import type {
  DistributionEntity,
  EventEntity,
  FakeDataset,
  OccupancyRecordEntity,
  OrganisationEntity,
  ResourceEntity,
  ShelterEntity,
  WarningEntity,
} from '../domain/analysis.entities.js';
import { createRandom, randomInt, type Random } from './random.js';

export const FAKE_DATA_SEED = 20261007;

const HOUR = 3_600_000;

/** Valid Mongo ObjectId text, so the dataset can be inserted as it is. */
export function fakeObjectId(n: number): string {
  return n.toString(16).padStart(24, '0');
}

interface WarningPlan {
  label: AlertLabel;
  level: AlertLevel;
  title: string;
  /** Hours after the event started. */
  atHour: number;
  /** Districts the warning covers; all of the event's districts when omitted. */
  districts?: DistrictCode[];
}

interface EventPlan {
  eventId: string;
  name: string;
  hazardType: HazardType;
  districtCodes: DistrictCode[];
  startedAt: string;
  durationHours: number;
  status: EventStatus;
  warnings: WarningPlan[];
  sheltersPerDistrict: number;
  withResources: boolean;
  /** Which records are marked PENDING synchronisation. */
  pending?: { lastShelterReadings?: number; resourceRecords?: number };
  /** Records that make the report fail its consistency check. */
  inconsistent?: boolean;
}

const standardWarnings = (
  hazard: string,
  updateDistricts?: DistrictCode[],
): WarningPlan[] => [
  {
    label: 'INITIAL_ALERT',
    level: 'MEDIUM',
    title: `${hazard} alert issued`,
    atHour: 0,
  },
  {
    label: 'ESCALATION',
    level: 'HIGH',
    title: `${hazard} alert escalated`,
    atHour: 6,
  },
  {
    label: 'DISTRICT_UPDATE',
    level: 'CRITICAL',
    title: 'Evacuation update for worst-hit districts',
    atHour: 18,
    districts: updateDistricts,
  },
  {
    label: 'FINAL_NOTICE',
    level: 'LOW',
    title: 'Situation easing, final notice',
    atHour: 40,
  },
];

const PLANS: EventPlan[] = [
  {
    eventId: 'DE-2026-0001',
    name: 'Kelani River Flood',
    hazardType: 'FLOOD',
    districtCodes: ['CMB', 'GMP', 'KAL'],
    startedAt: '2026-03-10T04:00:00.000Z',
    durationHours: 60,
    status: 'COMPLETED',
    warnings: standardWarnings('Flood', ['CMB', 'GMP']),
    sheltersPerDistrict: 2,
    withResources: true,
  },
  {
    eventId: 'DE-2026-0002',
    name: 'Ratnapura Landslide',
    hazardType: 'LANDSLIDE',
    districtCodes: ['RAT', 'KEG'],
    startedAt: '2026-04-21T02:30:00.000Z',
    durationHours: 48,
    status: 'COMPLETED',
    warnings: standardWarnings('Landslide'),
    sheltersPerDistrict: 2,
    withResources: true,
    pending: { lastShelterReadings: 2, resourceRecords: 2 },
  },
  {
    eventId: 'DE-2026-0003',
    name: 'Southern Cyclone',
    hazardType: 'STRONG_WINDS',
    districtCodes: ['GAL', 'MTR', 'HBA'],
    startedAt: '2026-05-18T10:00:00.000Z',
    durationHours: 36,
    status: 'COMPLETED',
    warnings: standardWarnings('Cyclone'),
    sheltersPerDistrict: 0,
    withResources: true,
  },
  {
    eventId: 'DE-2026-0004',
    name: 'Mahaweli Flood',
    hazardType: 'FLOOD',
    districtCodes: ['KAN', 'MTL', 'POL'],
    startedAt: '2026-06-02T06:00:00.000Z',
    durationHours: 72,
    status: 'COMPLETED',
    warnings: standardWarnings('Flood', ['POL']),
    sheltersPerDistrict: 1,
    withResources: false,
  },
  {
    eventId: 'DE-2026-0005',
    name: 'Puttalam Wind Event',
    hazardType: 'STRONG_WINDS',
    districtCodes: ['PUT'],
    startedAt: '2026-07-09T08:00:00.000Z',
    durationHours: 24,
    status: 'COMPLETED',
    warnings: [],
    sheltersPerDistrict: 0,
    withResources: false,
  },
  {
    eventId: 'DE-2026-0006',
    name: 'Batticaloa Flood',
    hazardType: 'FLOOD',
    districtCodes: ['BTC', 'AMP'],
    startedAt: '2026-08-14T05:00:00.000Z',
    durationHours: 48,
    status: 'COMPLETED',
    warnings: standardWarnings('Flood'),
    sheltersPerDistrict: 2,
    withResources: true,
    inconsistent: true,
  },
  {
    eventId: 'DE-2026-0007',
    name: 'Jaffna Flood (ongoing)',
    hazardType: 'FLOOD',
    districtCodes: ['JAF'],
    startedAt: '2026-10-05T03:00:00.000Z',
    durationHours: 0,
    status: 'ACTIVE',
    warnings: standardWarnings('Flood').slice(0, 2),
    sheltersPerDistrict: 1,
    withResources: true,
  },
];

const RESOURCES: Array<Omit<ResourceEntity, 'id'> & { unit: string }> = [
  { resourceName: 'Drinking Water', resourceType: 'WATER', unit: 'litres' },
  { resourceName: 'Dry Rations', resourceType: 'FOOD', unit: 'packs' },
  { resourceName: 'First Aid Kits', resourceType: 'MEDICINE', unit: 'kits' },
  {
    resourceName: 'Tarpaulins',
    resourceType: 'SHELTER_SUPPLIES',
    unit: 'sheets',
  },
];

const ORGANISATIONS: Array<Omit<OrganisationEntity, 'id'>> = [
  { organisationName: 'National Relief Fund', organisationType: 'GOVERNMENT' },
  { organisationName: 'Community Aid Network', organisationType: 'NGO' },
  { organisationName: 'Island Donors Alliance', organisationType: 'DONOR' },
];

/**
 * Builds the sample data for the post-disaster analysis demo: seven events, each
 * chosen to show one flow (see the plan). Pure and deterministic: the same seed
 * always gives the same records, so tests and the demo agree.
 */
export function buildFakeDataset(seed = FAKE_DATA_SEED): FakeDataset {
  const random = createRandom(seed);
  let nextId = 1;
  const id = () => fakeObjectId(nextId++);

  const resources: ResourceEntity[] = RESOURCES.map(
    ({ resourceName, resourceType }) => ({
      id: id(),
      resourceName,
      resourceType,
    }),
  );
  const organisations: OrganisationEntity[] = ORGANISATIONS.map((o) => ({
    id: id(),
    ...o,
  }));

  const dataset: FakeDataset = {
    events: [],
    warnings: [],
    shelters: [],
    occupancyRecords: [],
    resources,
    organisations,
    distributions: [],
  };

  for (const plan of PLANS) {
    const start = new Date(plan.startedAt);
    const event: EventEntity = {
      id: id(),
      eventId: plan.eventId,
      name: plan.name,
      hazardType: plan.hazardType,
      districtCodes: plan.districtCodes,
      startedAt: start,
      endedAt:
        plan.status === 'COMPLETED'
          ? new Date(start.getTime() + plan.durationHours * HOUR)
          : null,
      status: plan.status,
      isDemoData: true,
      updatedAt: new Date(start.getTime() + (plan.durationHours + 12) * HOUR),
    };
    dataset.events.push(event);

    const warnings = buildWarnings(plan, event, random, id);
    dataset.warnings.push(...warnings);

    const shelters = buildShelters(plan, event, random, id);
    dataset.shelters.push(...shelters);
    dataset.occupancyRecords.push(
      ...buildOccupancy(plan, event, shelters, random, id),
    );

    if (plan.withResources) {
      dataset.distributions.push(
        ...buildDistributions(
          plan,
          event,
          resources,
          organisations,
          random,
          id,
        ),
      );
    }
  }

  return dataset;
}

function buildWarnings(
  plan: EventPlan,
  event: EventEntity,
  random: Random,
  id: () => string,
): WarningEntity[] {
  // Registered citizens per district stay the same across an event's warnings.
  const registered = new Map<DistrictCode, number>(
    plan.districtCodes.map((code) => [code, randomInt(random, 20_000, 60_000)]),
  );
  return plan.warnings.map((warning) => ({
    id: id(),
    eventId: event.id,
    issuedAt: new Date(event.startedAt.getTime() + warning.atHour * HOUR),
    level: warning.level,
    label: warning.label,
    title: warning.title,
    districts: (warning.districts ?? plan.districtCodes).map((districtCode) => {
      const targeted = registered.get(districtCode) ?? 0;
      const reached = Math.floor(targeted * (0.82 + random() * 0.15));
      return { districtCode, targeted, reached };
    }),
  }));
}

function buildShelters(
  plan: EventPlan,
  event: EventEntity,
  random: Random,
  id: () => string,
): ShelterEntity[] {
  const shelters: ShelterEntity[] = [];
  for (const districtCode of plan.districtCodes) {
    for (let n = 1; n <= plan.sheltersPerDistrict; n++) {
      shelters.push({
        id: id(),
        eventId: event.id,
        name: `${districtName(districtCode)} Relief Centre ${n}`,
        districtCode,
        capacity: randomInt(random, 12, 40) * 10,
        status: event.status === 'ACTIVE' || n === 1 ? 'OPEN' : 'CLOSED',
      });
    }
  }
  return shelters;
}

/** A reading every six hours that rises and then falls, like people arriving and leaving. */
function buildOccupancy(
  plan: EventPlan,
  event: EventEntity,
  shelters: ShelterEntity[],
  random: Random,
  id: () => string,
): OccupancyRecordEntity[] {
  const READINGS = 8;
  const records: OccupancyRecordEntity[] = [];
  for (const shelter of shelters) {
    const peakShare = 0.5 + random() * 0.45;
    const shelterRecords: OccupancyRecordEntity[] = [];
    for (let k = 0; k < READINGS; k++) {
      const shape = Math.sin((Math.PI * (k + 0.5)) / READINGS);
      const noise = 0.9 + random() * 0.2;
      const occupancyCount = Math.min(
        shelter.capacity,
        Math.round(shelter.capacity * peakShare * shape * noise),
      );
      shelterRecords.push({
        id: id(),
        shelterId: shelter.id,
        eventId: event.id,
        occupancyCount,
        recordedAt: new Date(event.startedAt.getTime() + (k + 1) * 6 * HOUR),
        syncStatus: 'SYNCED',
      });
    }
    records.push(...shelterRecords);
  }

  const firstShelter = shelters[0];
  const pendingCount = plan.pending?.lastShelterReadings ?? 0;
  if (pendingCount > 0 && firstShelter) {
    const first = records.filter((r) => r.shelterId === firstShelter.id);
    for (const record of first.slice(-pendingCount))
      record.syncStatus = 'PENDING';
  }

  if (plan.inconsistent && firstShelter) {
    const base = event.startedAt.getTime();
    records.push(
      {
        id: id(),
        shelterId: firstShelter.id,
        eventId: event.id,
        occupancyCount: -25,
        recordedAt: new Date(base + 9 * HOUR),
        syncStatus: 'SYNCED',
      },
      {
        id: id(),
        shelterId: fakeObjectId(0xdead),
        eventId: event.id,
        occupancyCount: 80,
        recordedAt: new Date(base + 10 * HOUR),
        syncStatus: 'SYNCED',
      },
    );
  }
  return records;
}

function buildDistributions(
  plan: EventPlan,
  event: EventEntity,
  resources: ResourceEntity[],
  organisations: OrganisationEntity[],
  random: Random,
  id: () => string,
): DistributionEntity[] {
  const unitByType = new Map<ResourceType, string>(
    RESOURCES.map((r) => [r.resourceType, r.unit]),
  );
  const rows: DistributionEntity[] = [];
  for (const districtCode of plan.districtCodes) {
    resources.slice(0, 3).forEach((resource, i) => {
      const organisation =
        organisations[(i + rows.length) % organisations.length];
      if (!organisation) return;
      rows.push({
        id: id(),
        eventId: event.id,
        districtCode,
        resourceId: resource.id,
        organisationId: organisation.id,
        quantity: randomInt(random, 20, 300) * 10,
        unit: unitByType.get(resource.resourceType) ?? 'units',
        distributedAt: new Date(
          event.startedAt.getTime() + randomInt(random, 4, 36) * HOUR,
        ),
        syncStatus: 'SYNCED',
      });
    });
  }
  const pending: SyncStatus = 'PENDING';
  for (const row of rows.slice(0, plan.pending?.resourceRecords ?? 0)) {
    row.syncStatus = pending;
  }
  return rows;
}
