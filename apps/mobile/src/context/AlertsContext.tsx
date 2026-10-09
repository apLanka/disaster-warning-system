import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import type {
  CitizenAlertDto,
  CitizenProfileDto,
  RegisterCitizenInput,
} from '@repo/types';

import {
  acknowledgeAlert,
  getMyProfile,
  listMyAlerts,
  saveMyProfile,
} from '../api/alerts';
import {
  ALERTS_CACHE_KEY,
  ALERTS_POLL_MS,
  PROFILE_CACHE_KEY,
} from '../lib/alerts';

/** Where alerts come from. The app uses the API; tests pass a stub. */
export interface AlertsSource {
  getProfile(): Promise<CitizenProfileDto | null>;
  saveProfile(input: RegisterCitizenInput): Promise<CitizenProfileDto>;
  listAlerts(): Promise<CitizenAlertDto[]>;
  acknowledge(id: string): Promise<CitizenAlertDto>;
}

export const apiAlertsSource: AlertsSource = {
  getProfile: () => getMyProfile(),
  saveProfile: saveMyProfile,
  listAlerts: () => listMyAlerts(),
  acknowledge: acknowledgeAlert,
};

export interface AlertsValue {
  alerts: CitizenAlertDto[];
  profile: CitizenProfileDto | null;
  /** False until the first answer (or cached copy) arrives, so "set your district" never flashes. */
  profileLoaded: boolean;
  /** The last check failed: what is shown is the saved copy. */
  stale: boolean;
  refresh: () => Promise<void>;
  acknowledge: (id: string) => Promise<void>;
  saveProfile: (input: RegisterCitizenInput) => Promise<void>;
}

const AlertsContext = createContext<AlertsValue | null>(null);

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown): void {
  void AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => undefined);
}

/**
 * The citizen's warnings and alert district. There is no OS push in scope, so
 * this checks every 30 s, when the app returns to the front, and when a screen
 * asks. The last answer is kept on the phone so warnings still show offline.
 */
export function AlertsProvider({
  children,
  source = apiAlertsSource,
  pollMs = ALERTS_POLL_MS,
}: {
  children: ReactNode;
  source?: AlertsSource;
  pollMs?: number;
}) {
  const [alerts, setAlerts] = useState<CitizenAlertDto[]>([]);
  const [profile, setProfile] = useState<CitizenProfileDto | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [stale, setStale] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [nextProfile, nextAlerts] = await Promise.all([
        source.getProfile(),
        source.listAlerts(),
      ]);
      if (!mounted.current) return;
      setProfile(nextProfile);
      setAlerts(Array.isArray(nextAlerts) ? nextAlerts : []);
      setProfileLoaded(true);
      setStale(false);
      writeCache(PROFILE_CACHE_KEY, nextProfile);
      writeCache(ALERTS_CACHE_KEY, nextAlerts);
    } catch {
      // Offline or the server is down: keep showing the saved copy.
      if (!mounted.current) return;
      setStale(true);
      setProfileLoaded(true);
    }
  }, [source]);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      const [cachedProfile, cachedAlerts] = await Promise.all([
        readCache<CitizenProfileDto>(PROFILE_CACHE_KEY),
        readCache<CitizenAlertDto[]>(ALERTS_CACHE_KEY),
      ]);
      if (!mounted.current) return;
      if (cachedProfile) setProfile(cachedProfile);
      if (cachedAlerts) setAlerts(cachedAlerts);
      await refresh();
    })();
    const timer = setInterval(() => void refresh(), pollMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      mounted.current = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh, pollMs]);

  const acknowledge = useCallback(
    async (id: string) => {
      const updated = await source.acknowledge(id);
      setAlerts((current) => {
        const next = current.map((alert) =>
          alert.id === id ? updated : alert,
        );
        writeCache(ALERTS_CACHE_KEY, next);
        return next;
      });
    },
    [source],
  );

  const saveProfile = useCallback(
    async (input: RegisterCitizenInput) => {
      const saved = await source.saveProfile(input);
      setProfile(saved);
      setProfileLoaded(true);
      writeCache(PROFILE_CACHE_KEY, saved);
      void refresh();
    },
    [source, refresh],
  );

  const value = useMemo(
    () => ({
      alerts,
      profile,
      profileLoaded,
      stale,
      refresh,
      acknowledge,
      saveProfile,
    }),
    [alerts, profile, profileLoaded, stale, refresh, acknowledge, saveProfile],
  );
  return (
    <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
  );
}

export function useAlerts(): AlertsValue {
  const value = useContext(AlertsContext);
  if (!value) throw new Error('useAlerts must be used inside AlertsProvider');
  return value;
}
