import type { HazardReportDto } from '@repo/types';

export const PENDING_PATH = '/reports/pending';

const LIST_PATHS: Record<HazardReportDto['status'], string> = {
  PENDING_VERIFICATION: PENDING_PATH,
  VERIFIED: '/reports/verified',
  REJECTED: '/reports/rejected',
};

/** The list a report belongs to, for "Back to ..." links. */
export function listPathFor(status: HazardReportDto['status']): string {
  return LIST_PATHS[status];
}

export const ANALYSIS_PATH = '/analysis';

export const analysisScopePath = (eventId: string) =>
  `${ANALYSIS_PATH}/${encodeURIComponent(eventId)}`;

export const analysisReportPath = (eventId: string, district?: string) =>
  `${analysisScopePath(eventId)}/report${district ? `?district=${encodeURIComponent(district)}` : ''}`;
