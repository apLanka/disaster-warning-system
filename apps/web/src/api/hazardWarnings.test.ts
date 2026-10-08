import { describe, expect, it, vi } from 'vitest';

import { ApiError, NetworkError, toQueryString } from './client';
import {
  cancelWarning,
  createWarning,
  deleteDraft,
  describeWarningError,
  getPrefill,
  listWarnings,
  previewWarning,
  retryWarning,
} from './hazardWarnings';

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const fields = {
  hazardType: 'FLOOD',
  level: 'HIGH',
  districts: ['COLOMBO'],
} as const;

describe('hazard warning API client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts JSON with the officer headers', async () => {
    const fetchMock = mockFetch(201, { id: 'w1' });

    await createWarning({
      ...fields,
      districts: ['COLOMBO'],
      clientRequestId: 'c1',
      action: 'DRAFT',
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:3000/api/hazard-warnings');
    expect(init).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        'content-type': 'application/json',
        'x-officer-key': 'test-officer-key',
      }),
    });
    expect(JSON.parse(init.body)).toMatchObject({ action: 'DRAFT' });
  });

  it('uses the right path and method for each action', async () => {
    const fetchMock = mockFetch(200, {});
    await previewWarning({ ...fields, districts: ['COLOMBO'] });
    await retryWarning('w 1');
    await cancelWarning('w1', { reason: 'Water receded' });
    await getPrefill('r1');
    await listWarnings({ view: 'drafts', page: 2 });

    expect(
      fetchMock.mock.calls.map(([url, init]) => `${init.method} ${url}`),
    ).toEqual([
      'POST http://localhost:3000/api/hazard-warnings/preview',
      'POST http://localhost:3000/api/hazard-warnings/w%201/retry',
      'POST http://localhost:3000/api/hazard-warnings/w1/cancel',
      'GET http://localhost:3000/api/hazard-warnings/prefill?reportId=r1',
      'GET http://localhost:3000/api/hazard-warnings?view=drafts&page=2',
    ]);
  });

  it('accepts an empty 204 answer', async () => {
    mockFetch(204, undefined);
    await expect(deleteDraft('w1')).resolves.toBeUndefined();
  });

  it('builds query strings without undefined values', () => {
    expect(toQueryString({ view: 'past', page: undefined })).toBe('?view=past');
    expect(toQueryString({})).toBe('');
  });

  it('shows the server explanation for validation and conflicts', () => {
    expect(
      describeWarningError(
        new ApiError(
          409,
          'An active HIGH Flood warning already covers Colombo.',
        ),
      ),
    ).toBe('An active HIGH Flood warning already covers Colombo.');
    expect(
      describeWarningError(
        new ApiError(400, 'add at least one safety instruction'),
      ),
    ).toBe('add at least one safety instruction');
    expect(describeWarningError(new ApiError(404, 'x'))).toBe(
      'This warning could not be found.',
    );
    expect(describeWarningError(new NetworkError())).toBe(
      'Cannot reach the server. Check your connection and try again.',
    );
  });
});
