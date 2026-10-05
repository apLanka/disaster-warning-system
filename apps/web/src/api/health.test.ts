import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HealthResponse } from '@repo/types';

import { fetchHealth } from './health';

const okBody: HealthResponse = {
  status: 'ok',
  service: 'api',
  timestamp: '2026-01-01T00:00:00.000Z',
};

describe('fetchHealth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves with the health payload from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => okBody }),
    );

    await expect(fetchHealth()).resolves.toEqual(okBody);
  });

  it('requests the shared health path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => okBody,
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchHealth();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/health'),
      expect.anything(),
    );
  });

  it('rejects when the network request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(fetchHealth()).rejects.toThrow('offline');
  });

  it('rejects when the API responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }),
    );

    await expect(fetchHealth()).rejects.toThrow();
  });
});
