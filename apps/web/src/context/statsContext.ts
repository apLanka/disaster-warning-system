import { createContext } from 'react';

import type { ReportStats } from '@repo/types';

export interface ReportStatsValue {
  /** Null until the first load finishes. */
  stats: ReportStats | null;
  refresh: () => void;
}

export const ReportStatsContext = createContext<ReportStatsValue | null>(null);
