import type { ResourceDistributionRecord } from '../analysis-data.repository.js';
import type {
  OccupancyRecordEntity,
  ShelterEntity,
  WarningEntity,
} from '../domain/analysis.entities.js';

export class InconsistentRecordsError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Inconsistent records: ${problems.join('; ')}`);
    this.name = 'InconsistentRecordsError';
  }
}

export interface ConsistencyInput {
  warnings: readonly WarningEntity[];
  shelters: readonly ShelterEntity[];
  occupancyRecords: readonly OccupancyRecordEntity[];
  distributions: readonly ResourceDistributionRecord[];
}

const isCount = (n: number) => Number.isInteger(n) && n >= 0;

/**
 * A report is never built from records that contradict themselves. Throws one
 * error listing every problem found, so the cause is visible in the logs.
 */
export function assertConsistent(input: ConsistencyInput): void {
  const problems: string[] = [];
  const shelterIds = new Set(input.shelters.map((s) => s.id));

  for (const warning of input.warnings) {
    for (const d of warning.districts) {
      if (
        !isCount(d.targeted) ||
        !isCount(d.reached) ||
        d.reached > d.targeted
      ) {
        problems.push(
          `warning ${warning.id} has invalid reach for ${d.districtCode} (${d.reached} of ${d.targeted})`,
        );
      }
    }
  }
  for (const record of input.occupancyRecords) {
    if (!isCount(record.occupancyCount)) {
      problems.push(
        `occupancy record ${record.id} has invalid occupancy ${record.occupancyCount}`,
      );
    }
    if (!shelterIds.has(record.shelterId)) {
      problems.push(
        `occupancy record ${record.id} refers to unknown shelter ${record.shelterId}`,
      );
    }
  }
  for (const row of input.distributions) {
    if (!Number.isInteger(row.quantity) || row.quantity <= 0) {
      problems.push(
        `resource distribution ${row.id} has invalid quantity ${row.quantity}`,
      );
    }
  }

  if (problems.length > 0) throw new InconsistentRecordsError(problems);
}
