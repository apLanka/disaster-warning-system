import type { AnalysisScope, DistrictCode } from '@repo/types';

import type {
  OccupancyRecordEntity,
  ShelterEntity,
} from '../domain/analysis.entities.js';
import type { ResourceDistributionRecord } from '../analysis-data.repository.js';

/** The districts a report covers: all of the event's, or the one chosen. */
export function scopeDistricts(
  eventDistricts: readonly DistrictCode[],
  scope: AnalysisScope,
): DistrictCode[] {
  return scope.kind === 'ALL' ? [...eventDistricts] : [scope.districtCode];
}

export function sheltersInScope(
  shelters: readonly ShelterEntity[],
  districts: readonly DistrictCode[],
): ShelterEntity[] {
  return shelters.filter((s) => districts.includes(s.districtCode));
}

/** Readings belonging to the given shelters. */
export function recordsForShelters(
  records: readonly OccupancyRecordEntity[],
  shelters: readonly ShelterEntity[],
): OccupancyRecordEntity[] {
  const ids = new Set(shelters.map((s) => s.id));
  return records.filter((r) => ids.has(r.shelterId));
}

export function distributionsInScope(
  rows: readonly ResourceDistributionRecord[],
  districts: readonly DistrictCode[],
): ResourceDistributionRecord[] {
  return rows.filter((r) => districts.includes(r.districtCode));
}
