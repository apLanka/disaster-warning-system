import type { DataIssue, DataStatus } from '@repo/types';

export interface CompletenessInput {
  warningCount: number;
  shelterCount: number;
  occupancyRecords: ReadonlyArray<{ syncStatus: 'SYNCED' | 'PENDING' }>;
  distributions: ReadonlyArray<{ syncStatus: 'SYNCED' | 'PENDING' }>;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Incomplete when a section has no data or any record is still pending
 * synchronisation. Every reason is listed, so the officer sees what is missing.
 */
export function assessCompleteness(input: CompletenessInput): DataStatus {
  const issues: DataIssue[] = [];

  if (input.warningCount === 0) {
    issues.push({
      kind: 'NO_WARNINGS',
      message: 'No warnings were issued for this scope.',
    });
  }
  if (input.shelterCount === 0 || input.occupancyRecords.length === 0) {
    issues.push({
      kind: 'NO_SHELTER_DATA',
      message: 'No shelter occupancy data is recorded for this scope.',
    });
  }
  if (input.distributions.length === 0) {
    issues.push({
      kind: 'NO_RESOURCE_DATA',
      message: 'No resource distribution data is recorded for this scope.',
    });
  }

  const pendingShelter = input.occupancyRecords.filter(
    (r) => r.syncStatus === 'PENDING',
  ).length;
  if (pendingShelter > 0) {
    issues.push({
      kind: 'PENDING_SHELTER_RECORDS',
      message: `${plural(pendingShelter, 'shelter record')} pending synchronisation.`,
      count: pendingShelter,
    });
  }
  const pendingResources = input.distributions.filter(
    (r) => r.syncStatus === 'PENDING',
  ).length;
  if (pendingResources > 0) {
    issues.push({
      kind: 'PENDING_RESOURCE_RECORDS',
      message: `${plural(pendingResources, 'resource record')} pending synchronisation.`,
      count: pendingResources,
    });
  }

  return { complete: issues.length === 0, issues };
}
