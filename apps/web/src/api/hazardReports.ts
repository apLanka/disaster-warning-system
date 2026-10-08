import type {
  HazardReportDto,
  ListReportsQuery,
  Paginated,
  RejectReportInput,
  ReportStats,
  VerifyReportInput,
} from '@repo/types';

import { request, toQueryString } from './client';

const BASE = '/api/hazard-reports';

export function listReports(
  query: ListReportsQuery,
  signal?: AbortSignal,
): Promise<Paginated<HazardReportDto>> {
  return request(`${BASE}${toQueryString(query)}`, { signal });
}

export function getReport(
  id: string,
  signal?: AbortSignal,
): Promise<HazardReportDto> {
  return request(`${BASE}/${encodeURIComponent(id)}`, { signal });
}

export function getStats(signal?: AbortSignal): Promise<ReportStats> {
  return request(`${BASE}/stats`, { signal });
}

export function verifyReport(
  id: string,
  input: VerifyReportInput = {},
): Promise<HazardReportDto> {
  return request(`${BASE}/${encodeURIComponent(id)}/verify`, {
    method: 'PATCH',
    body: input,
  });
}

export function rejectReport(
  id: string,
  input: RejectReportInput,
): Promise<HazardReportDto> {
  return request(`${BASE}/${encodeURIComponent(id)}/reject`, {
    method: 'PATCH',
    body: input,
  });
}
