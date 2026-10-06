import { useNetInfo } from '@react-native-community/netinfo';
import { renderHook } from '@testing-library/react-native';

import { useNetworkStatus } from './useNetworkStatus';

const mockedNetInfo = jest.mocked(useNetInfo);

function networkIs(state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}) {
  mockedNetInfo.mockReturnValue(state as ReturnType<typeof useNetInfo>);
}

describe('useNetworkStatus', () => {
  it('is online when connected', async () => {
    networkIs({ isConnected: true, isInternetReachable: true });

    const { result } = await renderHook(() => useNetworkStatus());

    expect(result.current.isOffline).toBe(false);
  });

  it('is offline only when the phone has no connection at all', async () => {
    networkIs({ isConnected: false, isInternetReachable: false });

    const { result } = await renderHook(() => useNetworkStatus());

    expect(result.current.isOffline).toBe(true);
  });

  it('stays online when the public internet is unreachable but the phone is connected, so a local server can still be used', async () => {
    networkIs({ isConnected: true, isInternetReachable: false });

    const { result } = await renderHook(() => useNetworkStatus());

    expect(result.current.isOffline).toBe(false);
  });

  it('treats an unknown connection state as online, so a slow start never blocks a report', async () => {
    networkIs({ isConnected: null, isInternetReachable: null });

    const { result } = await renderHook(() => useNetworkStatus());

    expect(result.current.isOffline).toBe(false);
  });
});
