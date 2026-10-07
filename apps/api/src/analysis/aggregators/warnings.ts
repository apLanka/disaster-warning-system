import type { AlertTimelineItem, DistrictCode } from '@repo/types';

import type { WarningEntity } from '../domain/analysis.entities.js';

export interface WarningSummary {
  timeline: AlertTimelineItem[];
  targeted: number;
  reached: number;
  /** 0 to 1; zero when nobody was targeted (never NaN). */
  reachRate: number;
}

/**
 * The alert timeline and reach totals for the districts in scope. A warning that
 * does not cover any of them is left out; one that does counts only the in-scope
 * districts' numbers.
 */
export function summariseWarnings(
  warnings: readonly WarningEntity[],
  districts: readonly DistrictCode[],
): WarningSummary {
  const timeline: AlertTimelineItem[] = [];
  let targeted = 0;
  let reached = 0;

  const ordered = [...warnings].sort(
    (a, b) => a.issuedAt.getTime() - b.issuedAt.getTime(),
  );
  for (const warning of ordered) {
    const covered = warning.districts.filter((d) =>
      districts.includes(d.districtCode),
    );
    if (covered.length === 0) continue;
    const itemTargeted = covered.reduce((sum, d) => sum + d.targeted, 0);
    const itemReached = covered.reduce((sum, d) => sum + d.reached, 0);
    targeted += itemTargeted;
    reached += itemReached;
    timeline.push({
      id: warning.id,
      at: warning.issuedAt.toISOString(),
      level: warning.level,
      label: warning.label,
      title: warning.title,
      targeted: itemTargeted,
      reached: itemReached,
    });
  }

  return {
    timeline,
    targeted,
    reached,
    reachRate: targeted === 0 ? 0 : reached / targeted,
  };
}
