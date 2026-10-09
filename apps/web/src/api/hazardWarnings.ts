import type {
  CancelWarningInput,
  CreateWarningInput,
  HazardWarningDetailDto,
  HazardWarningDto,
  IssueWarningInput,
  ListWarningsQuery,
  Paginated,
  WarningFields,
  WarningPrefill,
  WarningPreview,
  WarningStats,
} from '@repo/types';

import { ApiError, describeError, request, toQueryString } from './client';

const BASE = '/api/hazard-warnings';
const path = (id: string, action = '') =>
  `${BASE}/${encodeURIComponent(id)}${action}`;

export function previewWarning(
  fields: WarningFields,
  signal?: AbortSignal,
): Promise<WarningPreview> {
  return request(`${BASE}/preview`, { method: 'POST', body: fields, signal });
}

export function createWarning(
  input: CreateWarningInput,
): Promise<HazardWarningDto> {
  return request(BASE, { method: 'POST', body: input });
}

export function updateDraft(
  id: string,
  fields: WarningFields,
): Promise<HazardWarningDto> {
  return request(path(id), { method: 'PATCH', body: fields });
}

export async function deleteDraft(id: string): Promise<void> {
  await request<undefined>(path(id), { method: 'DELETE' });
}

export function issueDraft(
  id: string,
  input: IssueWarningInput = {},
): Promise<HazardWarningDto> {
  return request(path(id, '/issue'), { method: 'POST', body: input });
}

export function retryWarning(id: string): Promise<HazardWarningDto> {
  return request(path(id, '/retry'), { method: 'POST' });
}

export function cancelWarning(
  id: string,
  input: CancelWarningInput,
): Promise<HazardWarningDto> {
  return request(path(id, '/cancel'), { method: 'POST', body: input });
}

export function listWarnings(
  query: ListWarningsQuery,
  signal?: AbortSignal,
): Promise<Paginated<HazardWarningDto>> {
  return request(`${BASE}${toQueryString(query)}`, { signal });
}

export function getWarning(
  id: string,
  signal?: AbortSignal,
): Promise<HazardWarningDetailDto> {
  return request(path(id), { signal });
}

export function getWarningStats(signal?: AbortSignal): Promise<WarningStats> {
  return request(`${BASE}/stats`, { signal });
}

export function getPrefill(
  reportId: string,
  signal?: AbortSignal,
): Promise<WarningPrefill> {
  return request(`${BASE}/prefill${toQueryString({ reportId })}`, { signal });
}

/**
 * Validation and conflict answers from the warnings API are written for the
 * officer (missing details, a duplicate warning), so they are shown as they are.
 */
export function describeWarningError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 409) return error.message;
    if (error.status === 404) return 'This warning could not be found.';
  }
  return describeError(error);
}
