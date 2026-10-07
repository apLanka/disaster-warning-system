import type {
  DisasterEventDto,
  ListEventsQuery,
  Paginated,
  PostDisasterReportDto,
} from '@repo/types';

import { ApiError, describeError, request } from './client';

const BASE = '/api/disaster-events';

function toQueryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

/** Completed disaster events that can be analysed. */
export function listEvents(
  query: ListEventsQuery,
  signal?: AbortSignal,
): Promise<Paginated<DisasterEventDto>> {
  return request(`${BASE}${toQueryString(query)}`, { signal });
}

export function getEvent(
  id: string,
  signal?: AbortSignal,
): Promise<DisasterEventDto> {
  return request(`${BASE}/${encodeURIComponent(id)}`, { signal });
}

/** Builds the report on the server; `district` limits it to one district. */
export function generateReport(
  id: string,
  district?: string,
  signal?: AbortSignal,
): Promise<PostDisasterReportDto> {
  return request(
    `${BASE}/${encodeURIComponent(id)}/report${toQueryString({ district })}`,
    { signal },
  );
}

/** Plain-language text for a failed analysis request. */
export function describeAnalysisError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'This disaster event could not be found.';
    if (error.status === 409) return 'Only completed events can be analysed.';
    if (error.status === 503)
      return 'Report generation failed. Please try again.';
  }
  return describeError(error);
}
