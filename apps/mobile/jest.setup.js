require('@testing-library/jest-native/extend-expect');

// Native modules have no implementation under Jest, so each is replaced by a
// stand-in. Tests override individual functions where a scenario needs it.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

let mockUuidCounter = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => {
    mockUuidCounter += 1;
    return `00000000-0000-4000-8000-${String(mockUuidCounter).padStart(12, '0')}`;
  }),
}));

// Every test starts with empty device storage.
beforeEach(async () => {
  const storage = require('@react-native-async-storage/async-storage');
  await (storage.default ?? storage).clear();
});
