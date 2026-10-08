import type { ReactNode } from 'react';

import { getWarningStats } from '../api/hazardWarnings';
import { useResource } from '../hooks/useResource';
import { WarningStatsContext } from './warningStatsContext';

/** One shared copy of the warning counts for the sidebar badge. */
export function WarningStatsProvider({ children }: { children: ReactNode }) {
  const { data, reload } = useResource((signal) => getWarningStats(signal), []);
  return (
    <WarningStatsContext.Provider value={{ stats: data, refresh: reload }}>
      {children}
    </WarningStatsContext.Provider>
  );
}
