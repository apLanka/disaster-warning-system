import type { ReactNode } from 'react';

import { getStats } from '../api/hazardReports';
import { useResource } from '../hooks/useResource';
import { ReportStatsContext } from './statsContext';

/** One shared copy of the counts, so the sidebar badge and the stat cards never disagree. */
export function ReportStatsProvider({ children }: { children: ReactNode }) {
  const { data, reload } = useResource((signal) => getStats(signal), []);

  return (
    <ReportStatsContext.Provider value={{ stats: data, refresh: reload }}>
      {children}
    </ReportStatsContext.Provider>
  );
}
