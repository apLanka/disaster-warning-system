import { useNetInfo } from '@react-native-community/netinfo';

/**
 * True only when the phone has no network connection at all.
 *
 * NetInfo's "internet reachable" flag is deliberately ignored: it probes a
 * public website, so it reads false on a local network or behind a firewall
 * even when our own server is reachable. Whether the server can be reached is
 * learned by trying: a send that fails is saved and retried.
 */
export function useNetworkStatus(): { isOffline: boolean } {
  const { isConnected } = useNetInfo();
  return { isOffline: isConnected === false };
}
