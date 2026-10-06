import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import {
  getReporterId,
  REPORTER_ID_KEY,
  resetReporterIdCache,
} from './reporterId';

describe('getReporterId', () => {
  beforeEach(() => {
    resetReporterIdCache();
  });

  it('creates an id the first time and stores it', async () => {
    const id = await getReporterId();

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await AsyncStorage.getItem(REPORTER_ID_KEY)).toBe(id);
  });

  it('returns the same id every time', async () => {
    const first = await getReporterId();
    const second = await getReporterId();

    expect(second).toBe(first);
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it('reuses the stored id after the app restarts', async () => {
    await AsyncStorage.setItem(REPORTER_ID_KEY, 'stored-id');

    expect(await getReporterId()).toBe('stored-id');
  });

  it('does not read storage again once it has the id', async () => {
    await AsyncStorage.setItem(REPORTER_ID_KEY, 'stored-id');
    await getReporterId();
    const getItem = jest.mocked(AsyncStorage.getItem);
    getItem.mockClear();

    await getReporterId();

    expect(getItem).not.toHaveBeenCalled();
  });
});
