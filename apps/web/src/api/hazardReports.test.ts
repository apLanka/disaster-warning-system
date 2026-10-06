import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getReport,
  getStats,
  listReports,
  rejectReport,
  verifyReport,
} from './hazardReports';

function stubFetch(body: unknown = {}) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => body });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const lastCall = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls[0]!;

describe('hazard report API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists with only the filters that were set', async () => {
    const fetchMock = stubFetch({ items: [], total: 0, page: 1, limit: 10 });

    await listReports({
      status: 'PENDING_VERIFICATION',
      type: undefined,
      sort: 'oldest',
      page: 2,
      limit: 10,
    });

    const url = new URL(lastCall(fetchMock)[0]);
    expect(url.pathname).toBe('/api/hazard-reports');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: 'PENDING_VERIFICATION',
      sort: 'oldest',
      page: '2',
      limit: '10',
    });
  });

  it('adds no query string when nothing is filtered', async () => {
    const fetchMock = stubFetch();

    await listReports({});

    expect(lastCall(fetchMock)[0]).toMatch(/\/api\/hazard-reports$/);
  });

  it('passes the abort signal along', async () => {
    const fetchMock = stubFetch();
    const controller = new AbortController();

    await getStats(controller.signal);

    expect(lastCall(fetchMock)[1].signal).toBe(controller.signal);
  });

  it('fetches one report by an encoded id', async () => {
    const fetchMock = stubFetch();

    await getReport('a/b');

    expect(lastCall(fetchMock)[0]).toMatch(/\/api\/hazard-reports\/a%2Fb$/);
  });

  it('verifies with PATCH and the notes', async () => {
    const fetchMock = stubFetch();

    await verifyReport('abc', { notes: 'ok' });

    const [url, init] = lastCall(fetchMock);
    expect(url).toMatch(/\/abc\/verify$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ notes: 'ok' });
  });

  it('verifies with an empty body when there are no notes', async () => {
    const fetchMock = stubFetch();

    await verifyReport('abc');

    expect(JSON.parse(lastCall(fetchMock)[1].body)).toEqual({});
  });

  it('rejects with the reason and details', async () => {
    const fetchMock = stubFetch();

    await rejectReport('abc', { reason: 'OTHER', details: 'Wrong place' });

    const [url, init] = lastCall(fetchMock);
    expect(url).toMatch(/\/abc\/reject$/);
    expect(JSON.parse(init.body)).toEqual({
      reason: 'OTHER',
      details: 'Wrong place',
    });
  });
});
