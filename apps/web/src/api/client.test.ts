import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  describeError,
  isConflict,
  NetworkError,
  request,
} from './client';

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the officer headers and returns the parsed body', async () => {
    const fetchMock = respond(200, { pending: 3 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await request('/api/hazard-reports/stats');

    expect(result).toEqual({ pending: 3 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/api\/hazard-reports\/stats$/);
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({
      'x-officer-key': expect.any(String),
      'x-officer-name': expect.any(String),
    });
    expect(init.headers).not.toHaveProperty('content-type');
  });

  it('sends a JSON body with its content type', async () => {
    const fetchMock = respond(200, {});
    vi.stubGlobal('fetch', fetchMock);

    await request('/x', { method: 'PATCH', body: { reason: 'DUPLICATE' } });

    const init = fetchMock.mock.calls[0]![1];
    expect(init.method).toBe('PATCH');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.body).toBe('{"reason":"DUPLICATE"}');
  });

  it('turns an error status into an ApiError carrying the server message', async () => {
    vi.stubGlobal(
      'fetch',
      respond(409, {
        statusCode: 409,
        error: 'Conflict',
        message: 'Already reviewed',
      }),
    );

    const failure = request('/x');

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({
      status: 409,
      message: 'Already reviewed',
    });
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('not json');
        },
      }),
    );

    await expect(request('/x')).rejects.toMatchObject({
      status: 502,
      message: 'Request failed (502)',
    });
  });

  it('reports an unreachable server as a NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));

    await expect(request('/x')).rejects.toBeInstanceOf(NetworkError);
  });

  it('lets an abort through unchanged, so it is not mistaken for an outage', async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));

    await expect(request('/x', { signal: controller.signal })).rejects.toBe(
      abort,
    );
  });
});

describe('describeError', () => {
  it.each([
    [new NetworkError(), /Cannot reach the server/],
    [new ApiError(401, 'x'), /not authorised/],
    [new ApiError(404, 'x'), /could not be found/],
    [new ApiError(409, 'x'), /already reviewed by another officer/],
    [new ApiError(500, 'x'), /server hit a problem/],
    [new ApiError(503, 'x'), /server hit a problem/],
    [new ApiError(400, 'details is required'), /^details is required$/],
    [new Error('boom'), /Something went wrong/],
    ['nope', /Something went wrong/],
  ])('describes %s in plain language', (error, expected) => {
    expect(describeError(error)).toMatch(expected);
  });
});

describe('isConflict', () => {
  it('is true only for a 409 ApiError', () => {
    expect(isConflict(new ApiError(409, 'x'))).toBe(true);
    expect(isConflict(new ApiError(400, 'x'))).toBe(false);
    expect(isConflict(new Error('x'))).toBe(false);
  });
});
