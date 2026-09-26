import { render } from '@testing-library/react-native';

import type { HealthResponse } from '@repo/types';

import { fetchHealth } from '../api/health';
import { HealthStatus } from './HealthStatus';

jest.mock('../api/health');

const mockedFetchHealth = jest.mocked(fetchHealth);

const okBody: HealthResponse = {
  status: 'ok',
  service: 'api',
  timestamp: '2026-01-01T00:00:00.000Z',
};

describe('HealthStatus', () => {
  afterEach(() => {
    mockedFetchHealth.mockReset();
  });

  it('shows the service name and status when the API is reachable', async () => {
    mockedFetchHealth.mockResolvedValue(okBody);

    const view = await render(<HealthStatus />);

    expect(await view.findByText('api: ok')).toBeOnTheScreen();
  });

  it('shows an unreachable message instead of a blank screen when the API is down', async () => {
    mockedFetchHealth.mockRejectedValue(new Error('offline'));

    const view = await render(<HealthStatus />);

    expect(await view.findByText('API unreachable')).toBeOnTheScreen();
  });
});
