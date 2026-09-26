import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HealthResponse } from '@repo/types';

import { HealthStatus } from './HealthStatus';

vi.mock('../api/health', () => ({ fetchHealth: vi.fn() }));

const { fetchHealth } = await import('../api/health');

const okBody: HealthResponse = {
  status: 'ok',
  service: 'api',
  timestamp: '2026-01-01T00:00:00.000Z',
};

describe('HealthStatus', () => {
  afterEach(() => {
    vi.mocked(fetchHealth).mockReset();
  });

  it('shows the service name and status when the API is reachable', async () => {
    vi.mocked(fetchHealth).mockResolvedValue(okBody);

    render(<HealthStatus />);

    expect(await screen.findByText('api: ok')).toBeInTheDocument();
  });

  it('shows an unreachable message instead of a blank screen when the API is down', async () => {
    vi.mocked(fetchHealth).mockRejectedValue(new Error('offline'));

    render(<HealthStatus />);

    expect(await screen.findByText('API unreachable')).toBeInTheDocument();
  });
});
