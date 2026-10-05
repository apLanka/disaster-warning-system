import { API_HEALTH_PATH, type HealthResponse } from '@repo/types';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export async function fetchHealth(
  signal?: AbortSignal,
): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}${API_HEALTH_PATH}`, { signal });

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
