import { useContext } from 'react';

import {
  WarningStatsContext,
  type WarningStatsValue,
} from '../context/warningStatsContext';

const NONE: WarningStatsValue = { stats: null, refresh: () => undefined };

/** Outside the dashboard (a page rendered on its own in a test) there is simply nothing to refresh. */
export function useWarningStats(): WarningStatsValue {
  return useContext(WarningStatsContext) ?? NONE;
}
