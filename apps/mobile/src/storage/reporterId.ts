import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export const REPORTER_ID_KEY = 'reporterId';

let cached: string | null = null;

/**
 * The device's anonymous identity, sent as x-reporter-id. It groups this
 * phone's reports; it does not sign anyone in (login is out of scope).
 */
export async function getReporterId(): Promise<string> {
  if (cached) return cached;

  const stored = await AsyncStorage.getItem(REPORTER_ID_KEY);
  if (stored) {
    cached = stored;
    return stored;
  }

  const created = Crypto.randomUUID();
  await AsyncStorage.setItem(REPORTER_ID_KEY, created);
  cached = created;
  return created;
}

/** For tests: forget the in-memory copy so the next call reads storage again. */
export function resetReporterIdCache(): void {
  cached = null;
}
