import type {
  OccupancyPoint,
  PeakOccupancy,
  ShelterSummary,
} from '@repo/types';

import type {
  OccupancyRecordEntity,
  ShelterEntity,
} from '../domain/analysis.entities.js';

const byTime = (a: OccupancyRecordEntity, b: OccupancyRecordEntity) =>
  a.recordedAt.getTime() - b.recordedAt.getTime();

/**
 * Total occupancy across shelters as a step function: a shelter's reading holds
 * until its next one, and every change in time gives one point holding the sum of
 * each shelter's latest reading. Readings at the same instant give one point.
 */
export function buildOccupancySeries(
  records: readonly OccupancyRecordEntity[],
): OccupancyPoint[] {
  const latest = new Map<string, number>();
  const series: OccupancyPoint[] = [];
  const ordered = [...records].sort(byTime);

  ordered.forEach((record, i) => {
    latest.set(record.shelterId, record.occupancyCount);
    const next = ordered[i + 1];
    if (next && next.recordedAt.getTime() === record.recordedAt.getTime())
      return;
    let total = 0;
    for (const value of latest.values()) total += value;
    series.push({ at: record.recordedAt.toISOString(), occupancy: total });
  });
  return series;
}

/**
 * The highest total occupancy at one moment, when it first happened, and the
 * combined capacity of the shelters in scope. Null when there is no reading.
 */
export function peakOccupancy(
  series: readonly OccupancyPoint[],
  shelters: readonly ShelterEntity[],
): PeakOccupancy | null {
  let peak: OccupancyPoint | null = null;
  for (const point of series) {
    if (!peak || point.occupancy > peak.occupancy) peak = point;
  }
  if (!peak) return null;
  return {
    value: peak.occupancy,
    at: peak.at,
    capacity: shelters.reduce((sum, s) => sum + s.capacity, 0),
  };
}

/** One row per shelter: peak and latest reading, and how many readings are pending sync. */
export function summariseShelters(
  shelters: readonly ShelterEntity[],
  records: readonly OccupancyRecordEntity[],
): ShelterSummary[] {
  return shelters.map((shelter) => {
    const own = records.filter((r) => r.shelterId === shelter.id).sort(byTime);
    return {
      shelterId: shelter.id,
      name: shelter.name,
      districtCode: shelter.districtCode,
      capacity: shelter.capacity,
      peakOccupancy: own.reduce((max, r) => Math.max(max, r.occupancyCount), 0),
      latestOccupancy: own.at(-1)?.occupancyCount ?? 0,
      status: shelter.status,
      pendingRecords: own.filter((r) => r.syncStatus === 'PENDING').length,
    };
  });
}
