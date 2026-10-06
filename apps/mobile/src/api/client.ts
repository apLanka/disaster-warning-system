import type { ApiErrorBody } from '@repo/types';

import { config } from '../config';
import { getReporterId } from '../storage/reporterId';

/** The API answered with an error status. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** The request never got an answer: the phone is offline or the server is down. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Cannot reach the server', { cause });
    this.name = 'NetworkError';
  }
}

/** A send that has not answered by now is treated as unreachable, so it is saved and retried. */
export const REQUEST_TIMEOUT_MS = 30_000;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: FormData;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ApiResponse<T> {
  status: number;
  data: T;
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
  {
    method = 'GET',
    body,
    signal,
    timeoutMs = REQUEST_TIMEOUT_MS,
  }: RequestOptions = {},
): Promise<ApiResponse<T>> {
  // No content-type for multipart: fetch adds it, with the boundary.
  const headers = { 'x-reporter-id': await getReporterId() };

  // One controller covers both the caller cancelling and the timeout.
  const controller = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => controller.abort();
  // A cancel can arrive while the device id is still being read, before this point.
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', onCallerAbort);
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
  } catch (cause) {
    // A cancel by the caller is their own doing, so it must not look like an outage.
    if (signal?.aborted && !timedOut) throw cause;
    // Expo wraps every failure as a FetchError, so a bug (such as an unsupported
    // upload body) looks the same as a dead connection. Say what really happened
    // in development, so it cannot hide behind "offline".
    if (__DEV__) console.warn('Request failed:', cause);
    throw new NetworkError(cause);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
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
  return { status: response.status, data: payload as T };
}

/** Plain-language text for a citizen, who may be stressed and is not a developer. */
export function describeError(error: unknown): string {
  if (error instanceof NetworkError) {
    return 'You seem to be offline. Check your connection and try again.';
  }
  if (error instanceof ApiError) {
    if (error.status === 413 || error.status === 415) {
      return 'A photo is too large or is not a supported image. Remove it and try again.';
    }
    if (error.status >= 500) {
      return 'Something went wrong on our side. Please try again in a moment.';
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
