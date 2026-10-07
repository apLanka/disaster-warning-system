import type {
  CitizenAlertDto,
  CitizenProfileDto,
  RegisterCitizenInput,
} from '@repo/types';

import { ApiError, request } from './client';

/** The citizen's alert district, or null when it was never set. */
export async function getMyProfile(
  signal?: AbortSignal,
): Promise<CitizenProfileDto | null> {
  try {
    const { data } = await request<CitizenProfileDto>('/api/citizens/me', {
      signal,
    });
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function saveMyProfile(
  input: RegisterCitizenInput,
): Promise<CitizenProfileDto> {
  const { data } = await request<CitizenProfileDto>('/api/citizens/me', {
    method: 'PUT',
    json: input,
  });
  return data;
}

export async function listMyAlerts(
  signal?: AbortSignal,
): Promise<CitizenAlertDto[]> {
  const { data } = await request<CitizenAlertDto[]>('/api/alerts/mine', {
    signal,
  });
  return data;
}

export async function acknowledgeAlert(id: string): Promise<CitizenAlertDto> {
  const { data } = await request<CitizenAlertDto>(
    `/api/alerts/${encodeURIComponent(id)}/acknowledge`,
    { method: 'POST' },
  );
  return data;
}
