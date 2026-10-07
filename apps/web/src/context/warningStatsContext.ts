import { createContext } from 'react';

import type { WarningStats } from '@repo/types';

export interface WarningStatsValue {
  /** Null until the first load finishes. */
  stats: WarningStats | null;
  refresh: () => void;
}

export const WarningStatsContext = createContext<WarningStatsValue | null>(
  null,
);
