import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';

import type { CitizenProfileDto } from '@repo/types';

import { NetworkError } from '../api/client';
import { ALERTS_CACHE_KEY, PROFILE_CACHE_KEY } from '../lib/alerts';
import { alert, stubAlertsSource } from '../test/fixtures';
import {
  AlertsProvider,
  apiAlertsSource,
  useAlerts,
  type AlertsSource,
} from './AlertsContext';
import * as alertsApi from '../api/alerts';

function Probe() {
  const { alerts, profile, stale } = useAlerts();
  return (
    <Text>
      {JSON.stringify({
        ids: alerts.map((a) => [a.id, a.acknowledgedAt]),
        district: profile?.district ?? null,
        stale,
      })}
    </Text>
  );
}

let api: ReturnType<typeof useAlerts>;
function Grab() {
  api = useAlerts();
  return null;
}

async function renderWith(source: AlertsSource, pollMs = 30_000) {
  await render(
    <AlertsProvider source={source} pollMs={pollMs}>
      <Probe />
      <Grab />
    </AlertsProvider>,
  );
}

const shown = () => JSON.parse(screen.getByText(/ids/).props.children);

describe('AlertsProvider', () => {
  it('loads the profile and alerts', async () => {
    await renderWith(
      stubAlertsSource({
        getProfile: async () => ({ district: 'COLOMBO', updatedAt: '' }),
        listAlerts: async () => [alert()],
      }),
    );
    await waitFor(() =>
      expect(shown()).toEqual({
        ids: [['w1', null]],
        district: 'COLOMBO',
        stale: false,
      }),
    );
  });

  it('shows the saved alerts and marks them stale when offline', async () => {
    await AsyncStorage.setItem(
      ALERTS_CACHE_KEY,
      JSON.stringify([alert({ id: 'saved' })]),
    );
    await renderWith(
      stubAlertsSource({
        listAlerts: async () => {
          throw new NetworkError();
        },
      }),
    );
    await waitFor(() =>
      expect(shown()).toMatchObject({ ids: [['saved', null]], stale: true }),
    );
  });

  it('acknowledges and updates the list', async () => {
    const acknowledged = alert({ acknowledgedAt: '2026-10-07T10:00:00.000Z' });
    await renderWith(
      stubAlertsSource({
        listAlerts: async () => [alert()],
        acknowledge: async () => acknowledged,
      }),
    );
    await waitFor(() => expect(shown().ids).toHaveLength(1));

    await act(() => api.acknowledge('w1'));
    expect(shown().ids).toEqual([['w1', '2026-10-07T10:00:00.000Z']]);
  });

  it('saves the profile, then checks for alerts in the new district', async () => {
    const listAlerts = jest.fn().mockResolvedValue([]);
    let stored: CitizenProfileDto | null = null;
    await renderWith(
      stubAlertsSource({
        listAlerts,
        getProfile: async () => stored,
        saveProfile: async (input) => (stored = { ...input, updatedAt: '' }),
      }),
    );
    await waitFor(() => expect(listAlerts).toHaveBeenCalledTimes(1));

    await act(() => api.saveProfile({ district: 'KANDY' }));
    expect(shown().district).toBe('KANDY');
    await waitFor(() => expect(listAlerts).toHaveBeenCalledTimes(2));
  });

  it('checks again on the poll interval', async () => {
    jest.useFakeTimers();
    const listAlerts = jest.fn().mockResolvedValue([]);
    await renderWith(stubAlertsSource({ listAlerts }), 1000);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(listAlerts.mock.calls.length).toBeGreaterThanOrEqual(2);
    jest.useRealTimers();
  });

  it('ignores a corrupted saved copy and a malformed answer', async () => {
    await AsyncStorage.setItem(ALERTS_CACHE_KEY, '{not json');
    await AsyncStorage.setItem(
      PROFILE_CACHE_KEY,
      JSON.stringify({ district: 'GALLE', updatedAt: '' }),
    );
    await renderWith(
      stubAlertsSource({ listAlerts: async () => ({ oops: true }) as never }),
    );
    await waitFor(() =>
      expect(shown()).toEqual({ ids: [], district: null, stale: false }),
    );
  });

  it('checks again when the app comes back to the front', async () => {
    const listeners: ((state: string) => void)[] = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        listeners.push(listener as (state: string) => void);
        return { remove: jest.fn() } as never;
      });
    const listAlerts = jest.fn().mockResolvedValue([]);
    await renderWith(stubAlertsSource({ listAlerts }));
    await waitFor(() => expect(listAlerts).toHaveBeenCalledTimes(1));

    await act(async () => {
      listeners.forEach((listener) => listener('background'));
      listeners.forEach((listener) => listener('active'));
    });
    await waitFor(() => expect(listAlerts).toHaveBeenCalledTimes(2));
  });

  it('reads from the API by default', async () => {
    const getProfile = jest
      .spyOn(alertsApi, 'getMyProfile')
      .mockResolvedValue(null);
    const listMyAlerts = jest
      .spyOn(alertsApi, 'listMyAlerts')
      .mockResolvedValue([]);

    await expect(apiAlertsSource.getProfile()).resolves.toBeNull();
    await expect(apiAlertsSource.listAlerts()).resolves.toEqual([]);
    expect(getProfile).toHaveBeenCalled();
    expect(listMyAlerts).toHaveBeenCalled();
  });

  it('fails loudly outside the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(render(<Probe />)).rejects.toThrow(
      'useAlerts must be used inside AlertsProvider',
    );
  });
});
