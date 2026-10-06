import * as ExpoLocation from 'expo-location';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { LOCATION_TIMEOUT_MS, useLocation } from './useLocation';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const location = jest.mocked(ExpoLocation);
const POSITION = { coords: { latitude: 7.2906, longitude: 80.6337 } };

function gpsWorks() {
  location.requestForegroundPermissionsAsync.mockResolvedValue({
    granted: true,
  } as never);
  location.hasServicesEnabledAsync.mockResolvedValue(true);
  location.getCurrentPositionAsync.mockResolvedValue(POSITION as never);
}

describe('useLocation', () => {
  beforeEach(() => gpsWorks());

  it('shows loading while it waits for the position, then provides it', async () => {
    let arrive!: (value: unknown) => void;
    location.getCurrentPositionAsync.mockReturnValue(
      new Promise((resolve) => {
        arrive = resolve;
      }) as never,
    );

    const { result } = await renderHook(() => useLocation(true));
    expect(result.current.status).toBe('loading');
    expect(result.current.location).toBeNull();

    await act(async () => arrive(POSITION));

    expect(result.current.status).toBe('ready');
    expect(result.current.location).toEqual({
      latitude: 7.2906,
      longitude: 80.6337,
    });
  });

  it('asks for balanced accuracy, which is quick and enough to place a hazard', async () => {
    await renderHook(() => useLocation(true));

    await waitFor(() =>
      expect(location.getCurrentPositionAsync).toHaveBeenCalledWith({
        accuracy: 3,
      }),
    );
  });

  it('reports "denied" when the citizen refuses access, and never asks for a position', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
    } as never);

    const { result } = await renderHook(() => useLocation(true));

    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(result.current.location).toBeNull();
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('reports "unavailable" when location services are switched off', async () => {
    location.hasServicesEnabledAsync.mockResolvedValue(false);

    const { result } = await renderHook(() => useLocation(true));

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('reports "unavailable" when the position cannot be read', async () => {
    location.getCurrentPositionAsync.mockRejectedValue(new Error('no fix'));

    const { result } = await renderHook(() => useLocation(true));

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
  });

  it('does nothing when disabled, because a position was already found', async () => {
    await renderHook(() => useLocation(false));

    expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('tries again on request, and can then succeed', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValueOnce({
      granted: false,
    } as never);
    const { result } = await renderHook(() => useLocation(true));
    await waitFor(() => expect(result.current.status).toBe('denied'));

    await act(async () => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('opens the phone settings on request', async () => {
    const openSettings = jest
      .spyOn(Linking, 'openSettings')
      .mockResolvedValue();
    const { result } = await renderHook(() => useLocation(true));

    await act(async () => result.current.openSettings());

    expect(openSettings).toHaveBeenCalled();
  });

  it('gives up on a position that never arrives, instead of waiting forever', async () => {
    jest.useFakeTimers();
    location.getCurrentPositionAsync.mockReturnValue(
      new Promise(() => undefined),
    );
    const { result } = await renderHook(() => useLocation(true));

    await act(async () =>
      jest.advanceTimersByTimeAsync(LOCATION_TIMEOUT_MS + 100),
    );

    expect(result.current.status).toBe('unavailable');
    jest.useRealTimers();
  });

  it('ignores a position that arrives after the screen has gone', async () => {
    let arrive!: (value: unknown) => void;
    location.getCurrentPositionAsync.mockReturnValue(
      new Promise((resolve) => {
        arrive = resolve;
      }) as never,
    );
    const { result, unmount } = await renderHook(() => useLocation(true));
    await waitFor(() =>
      expect(location.getCurrentPositionAsync).toHaveBeenCalled(),
    );

    await unmount();
    await act(async () => arrive(POSITION));

    expect(result.current.location).toBeNull();
  });
});
