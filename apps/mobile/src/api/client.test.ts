import { resetReporterIdCache } from '../storage/reporterId';
import {
  ApiError,
  describeError,
  NetworkError,
  request,
  REQUEST_TIMEOUT_MS,
} from './client';

function respond(status: number, body: unknown) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('request', () => {
  beforeEach(() => {
    resetReporterIdCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends the device id and returns the status with the body', async () => {
    const fetchMock = respond(201, { id: 'r1' });
    globalThis.fetch = fetchMock;

    const result = await request('/api/x', { method: 'POST' });

    expect(result).toEqual({ status: 201, data: { id: 'r1' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/x$/);
    expect(init.method).toBe('POST');
    expect(init.headers['x-reporter-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(init.headers).not.toHaveProperty('content-type');
  });

  it('sends a JSON body with its content type', async () => {
    const fetchMock = respond(200, { ok: true });
    globalThis.fetch = fetchMock;

    await request('/api/citizens/me', {
      method: 'PUT',
      json: { district: 'KANDY' },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.body).toBe('{"district":"KANDY"}');
  });

  it('turns an error status into an ApiError carrying the server message', async () => {
    globalThis.fetch = respond(400, {
      statusCode: 400,
      error: 'Bad Request',
      message: 'latitude is wrong',
    });

    await expect(request('/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'latitude is wrong',
    });
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(request('/x')).rejects.toMatchObject({
      status: 502,
      message: 'Request failed (502)',
    });
  });

  it('reports an unreachable server as a NetworkError', async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('Network request failed'));

    await expect(request('/x')).rejects.toBeInstanceOf(NetworkError);
  });

  it('lets an abort through, so it is not mistaken for being offline', async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new Error('Aborted');
    globalThis.fetch = jest.fn().mockRejectedValue(abort);

    await expect(request('/x', { signal: controller.signal })).rejects.toBe(
      abort,
    );
  });
});

describe('request timeout', () => {
  beforeEach(() => {
    resetReporterIdCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** A fetch that never answers until its signal aborts, as a stalled connection behaves. */
  function stalledFetch() {
    globalThis.fetch = jest.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const abort = () => reject(new Error('aborted'));
          // Like the real fetch, fail at once if the signal is already cancelled.
          if (init?.signal?.aborted) abort();
          else init?.signal?.addEventListener('abort', abort);
        }),
    ) as unknown as typeof fetch;
  }

  it('gives up on a request that never answers and reports the server as unreachable', async () => {
    stalledFetch();

    const outcome = request('/x');
    const settled = expect(outcome).rejects.toBeInstanceOf(NetworkError);
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

    await settled;
  });

  it('honours a shorter timeout', async () => {
    stalledFetch();

    const outcome = request('/x', { timeoutMs: 1000 });
    const settled = expect(outcome).rejects.toBeInstanceOf(NetworkError);
    await jest.advanceTimersByTimeAsync(1000);

    await settled;
  });

  it('does not time out a request that answers in time', async () => {
    globalThis.fetch = respond(200, { ok: true });

    const result = await request('/x');
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS * 2);

    expect(result.data).toEqual({ ok: true });
  });

  it('passes the caller cancelling through unchanged, rather than calling it a timeout', async () => {
    stalledFetch();
    const caller = new AbortController();

    const outcome = request('/x', { signal: caller.signal });
    const settled = expect(outcome).rejects.toThrow('aborted');
    caller.abort();

    await settled;
  });

  it('does not send a request the caller cancelled before it started', async () => {
    stalledFetch();
    const caller = new AbortController();
    caller.abort();

    await expect(request('/x', { signal: caller.signal })).rejects.toThrow(
      'aborted',
    );
  });

  it('stops the timer once the request finishes, so nothing fires later', async () => {
    globalThis.fetch = respond(200, {});

    await request('/x');

    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('describeError', () => {
  it.each([
    [new NetworkError(), /seem to be offline/],
    [new ApiError(413, 'x'), /photo is too large/],
    [new ApiError(415, 'x'), /not a supported image/],
    [new ApiError(500, 'x'), /went wrong on our side/],
    [new ApiError(502, 'x'), /went wrong on our side/],
    [new ApiError(400, 'latitude is wrong'), /^latitude is wrong$/],
    [new Error('boom'), /Something went wrong/],
    ['nope', /Something went wrong/],
  ])('describes %s in plain words', (error, expected) => {
    expect(describeError(error)).toMatch(expected);
  });
});
