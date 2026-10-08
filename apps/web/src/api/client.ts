import type { ApiErrorBody } from '@repo/types';

import { config } from '../config';

/** The API answered with an error status. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** The request never got an answer: the server is down or the network is. */
export class NetworkError extends Error {
  constructor() {
    super('Cannot reach the server');
    this.name = 'NetworkError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ApiErrorBody).message === 'string'
  );
}

export async function request<T>(
  path: string,
  { method = 'GET', body, headers: customHeaders, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'x-officer-key': config.officerKey,
    'x-officer-name': config.officerName,
    ...customHeaders,
  };
  if (body !== undefined) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    // An abort is the caller's own doing, so it must not look like an outage.
    if (signal?.aborted) throw cause;
    throw new NetworkError();
  }

  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      isErrorBody(payload)
        ? payload.message
        : `Request failed (${response.status})`,
    );
  }
  return payload as T;
}

/** Plain-language text for an error, safe to show an officer. */
export function describeError(error: unknown): string {
  if (error instanceof NetworkError) {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'The portal is not authorised. Check the officer key configuration.';
    }
    if (error.status === 404) return 'This report could not be found.';
    if (error.status === 409) {
      return 'This report was already reviewed by another officer.';
    }
    if (error.status >= 500) {
      return 'The server hit a problem. Please try again in a moment.';
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}
