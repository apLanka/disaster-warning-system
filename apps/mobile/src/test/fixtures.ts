import type { CitizenAlertDto } from '@repo/types';

import type { AlertsSource } from '../context/AlertsContext';

export function alert(
  overrides: Partial<CitizenAlertDto> = {},
): CitizenAlertDto {
  return {
    id: 'w1',
    reference: 'HW-2026-0001',
    hazardType: 'FLOOD',
    level: 'HIGH',
    districts: ['COLOMBO'],
    description: 'Heavy rainfall expected.',
    safetyInstructions: ['Move to higher ground immediately'],
    issuedAt: '2026-10-07T09:00:00.000Z',
    validUntil: '2099-01-01T00:00:00.000Z',
    state: 'ACTIVE',
    acknowledgedAt: null,
    ...overrides,
  };
}

/** Nothing registered and no alerts, unless a test says otherwise. */
export function stubAlertsSource(
  overrides: Partial<AlertsSource> = {},
): AlertsSource {
  return {
    getProfile: async () => null,
    saveProfile: async (input) => ({
      ...input,
      updatedAt: new Date().toISOString(),
    }),
    listAlerts: async () => [],
    acknowledge: async () => {
      throw new Error('acknowledge was not stubbed');
    },
    ...overrides,
  };
}
