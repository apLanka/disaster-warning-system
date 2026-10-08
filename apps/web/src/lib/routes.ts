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

export const WARNINGS_PATH = '/warnings';
export const NEW_WARNING_PATH = '/warnings/new';
export const REVIEW_WARNING_PATH = '/warnings/review';

export function warningPath(id: string): string {
  return `${WARNINGS_PATH}/${encodeURIComponent(id)}`;
}

export function editWarningPath(id: string): string {
  return `${warningPath(id)}/edit`;
}

export const ANALYSIS_PATH = '/analysis';

export const analysisScopePath = (eventId: string) =>
  `${ANALYSIS_PATH}/${encodeURIComponent(eventId)}`;

export const analysisReportPath = (eventId: string, district?: string) =>
  `${analysisScopePath(eventId)}/report${district ? `?district=${encodeURIComponent(district)}` : ''}`;
