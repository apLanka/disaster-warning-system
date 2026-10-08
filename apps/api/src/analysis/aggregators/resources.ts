import type { ResourceDistrictTotal, ResourceRow } from '@repo/types';

import type { ResourceDistributionRecord } from '../analysis-data.repository.js';

export interface ResourceSummary {
  rows: ResourceRow[];
  totalsByDistrict: ResourceDistrictTotal[];
  districtsReceiving: number;
}

/**
 * The resource table, the quantity per district (what the bar chart draws; units
 * differ between resources, so it is a count of items distributed), and how many
 * districts received anything.
 */
export function summariseResources(
  records: readonly ResourceDistributionRecord[],
): ResourceSummary {
  const rows: ResourceRow[] = [...records]
    .sort(
      (a, b) =>
        a.districtCode.localeCompare(b.districtCode) ||
        a.resourceName.localeCompare(b.resourceName),
    )
    .map((r) => ({
      districtCode: r.districtCode,
      resourceName: r.resourceName,
      resourceType: r.resourceType,
      quantity: r.quantity,
      unit: r.unit,
      organisationName: r.organisationName,
      syncStatus: r.syncStatus,
    }));

  const totals = new Map<ResourceRow['districtCode'], number>();
  for (const row of rows) {
    totals.set(
      row.districtCode,
      (totals.get(row.districtCode) ?? 0) + row.quantity,
    );
  }

  return {
    rows,
    totalsByDistrict: [...totals].map(([districtCode, quantity]) => ({
      districtCode,
      quantity,
    })),
    districtsReceiving: totals.size,
  };
}
