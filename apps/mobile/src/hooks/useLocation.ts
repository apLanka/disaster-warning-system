import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

import type { GeoLocation } from '@repo/types';

export type LocationStatus = 'loading' | 'ready' | 'denied' | 'unavailable';

interface LocationState {
  status: LocationStatus;
  location: GeoLocation | null;
}

export interface UseLocation extends LocationState {
  retry: () => void;
  openSettings: () => void;
}

/** A GPS fix indoors can take forever; after this the citizen is told and can retry. */
export const LOCATION_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Location timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * The phone's current position. Reports why it could not get one, so the
 * screen can offer the right next step: retry, or open Settings.
 */
export function useLocation(enabled: boolean): UseLocation {
  const [state, setState] = useState<LocationState>({
    status: 'loading',
    location: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: 'loading', location: null });

    async function locate() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted) {
          setState({ status: 'denied', location: null });
          return;
        }

        if (!(await Location.hasServicesEnabledAsync())) {
          if (!cancelled) setState({ status: 'unavailable', location: null });
          return;
        }

        const position = await withTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          LOCATION_TIMEOUT_MS,
        );
        if (cancelled) return;
        setState({
          status: 'ready',
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
      } catch {
        if (!cancelled) setState({ status: 'unavailable', location: null });
      }
    }

    void locate();
    return () => {
      cancelled = true;
    };
  }, [enabled, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return { ...state, retry, openSettings };
}
