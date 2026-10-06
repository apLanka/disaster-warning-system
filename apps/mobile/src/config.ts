export const DEFAULT_API_BASE_URL = 'http://localhost:3000';

/**
 * A physical phone cannot reach the computer through "localhost": set
 * EXPO_PUBLIC_API_BASE_URL to the computer's address on the network.
 */
export const config = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL,
};
