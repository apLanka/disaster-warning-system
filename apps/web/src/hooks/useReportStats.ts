import { useContext } from 'react';

import {
  ReportStatsContext,
  type ReportStatsValue,
} from '../context/statsContext';

export function useReportStats(): ReportStatsValue {
  const value = useContext(ReportStatsContext);
  if (!value)
    throw new Error('useReportStats must be used inside ReportStatsProvider');
  return value;
}
