import type { DistrictCode } from '@repo/types';

import type { WarningEntity } from './domain/analysis.entities.js';

/** Sum of `reached` over the warnings, limited to the given districts when set. */
export function sumReached(
  warnings: readonly WarningEntity[],
  districts?: readonly DistrictCode[],
): number {
  let total = 0;
  for (const warning of warnings) {
    for (const entry of warning.districts) {
      if (!districts || districts.includes(entry.districtCode)) {
        total += entry.reached;
      }
    }
  }
  return total;
}
