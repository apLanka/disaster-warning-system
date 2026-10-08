import type { DistrictCode } from '@repo/types';

import type { ResourceDistributionRecord } from '../analysis-data.repository.js';
import type {
  OccupancyRecordEntity,
  ShelterEntity,
  WarningEntity,
} from '../domain/analysis.entities.js';

/** Hours after a fixed start, as a Date. */
export const hour = (h: number) =>
  new Date(Date.UTC(2026, 2, 10, 0, 0, 0) + h * 3_600_000);

export function shelter(
  id: string,
  districtCode: DistrictCode = 'CMB',
  capacity = 100,
): ShelterEntity {
  return {
    id,
    eventId: 'e',
    name: `Shelter ${id}`,
    districtCode,
    capacity,
    status: 'OPEN',
  };
}

export function reading(
  shelterId: string,
  atHour: number,
  occupancyCount: number,
  syncStatus: 'SYNCED' | 'PENDING' = 'SYNCED',
): OccupancyRecordEntity {
  return {
    id: `${shelterId}-${atHour}`,
    shelterId,
    eventId: 'e',
    occupancyCount,
    recordedAt: hour(atHour),
    syncStatus,
  };
}

export function warning(
  id: string,
  atHour: number,
  districts: Array<[DistrictCode, number, number]>,
): WarningEntity {
  return {
    id,
    eventId: 'e',
    issuedAt: hour(atHour),
    level: 'HIGH',
    label: 'INITIAL_ALERT',
    title: `Warning ${id}`,
    districts: districts.map(([districtCode, targeted, reached]) => ({
      districtCode,
      targeted,
      reached,
    })),
  };
}

export function distribution(
  id: string,
  districtCode: DistrictCode,
  quantity: number,
  syncStatus: 'SYNCED' | 'PENDING' = 'SYNCED',
): ResourceDistributionRecord {
  return {
    id,
    eventId: 'e',
    districtCode,
    resourceId: 'r',
    organisationId: 'o',
    quantity,
    unit: 'packs',
    distributedAt: hour(5),
    syncStatus,
    resourceName: 'Dry Rations',
    resourceType: 'FOOD',
    organisationName: 'Aid Network',
  };
}
