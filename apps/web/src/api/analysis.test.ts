import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateReport, getEvent, listEvents } from './analysis';

function stubFetch(body: unknown = {}) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => body });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const urlOf = (mock: ReturnType<typeof vi.fn>) =>
  new URL(mock.mock.calls[0]![0]);

describe('analysis API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists events with only the filters that were set', async () => {
    const fetchMock = stubFetch({ items: [], total: 0, page: 1, limit: 10 });

    await listEvents({
      search: 'kelani',
      hazardType: undefined,
      district: 'CMB',
      page: 2,
      limit: 10,
    });

    const url = urlOf(fetchMock);
    expect(url.pathname).toBe('/api/disaster-events');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      search: 'kelani',
      district: 'CMB',
      page: '2',
      limit: '10',
    });
  });

  it('skips blank filters and sends no query string when there are none', async () => {
    const fetchMock = stubFetch({});
    await listEvents({ search: '' });
    expect(urlOf(fetchMock).search).toBe('');
  });

  it('gets one event by id, encoded', async () => {
    const fetchMock = stubFetch({});
    await getEvent('a/b');
    expect(urlOf(fetchMock).pathname).toBe('/api/disaster-events/a%2Fb');
  });

  it('generates a report for all districts, or for one', async () => {
    const all = stubFetch({});
    await generateReport('abc');
    expect(urlOf(all).pathname).toBe('/api/disaster-events/abc/report');
    expect(urlOf(all).search).toBe('');

    const one = stubFetch({});
    await generateReport('abc', 'CMB');
    expect(urlOf(one).searchParams.get('district')).toBe('CMB');
  });

  it('sends the officer headers and passes the abort signal', async () => {
    const fetchMock = stubFetch({});
    const controller = new AbortController();
    await generateReport('abc', undefined, controller.signal);
    const init = fetchMock.mock.calls[0]![1];
    expect(init.headers['x-officer-key']).toBeTruthy();
    expect(init.signal).toBe(controller.signal);
  });
});
