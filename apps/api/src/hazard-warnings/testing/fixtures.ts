import type { ChannelKind } from '@repo/types';

import type {
  AlertDeliveryEntity,
  CitizenEntity,
} from '../../citizens/citizen.entity.js';
import type {
  DisseminationChannelState,
  HazardWarningEntity,
} from '../domain/hazard-warning.entity.js';

export const WARNING_ID = '6700aa77bcf86cd799439011';
export const OTHER_WARNING_ID = '6700aa77bcf86cd799439022';
export const REPORT_ID = '665f1f77bcf86cd799439011';
export const DEVICE_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
export const OTHER_DEVICE_ID = '11111111-2222-4333-8444-555555555555';
export const CLIENT_REQUEST_ID = '7b0e6c0e-0f5e-4a52-9a77-3d3a0c1f9a11';
export const OFFICER = 'Officer Silva';
export const NOW = new Date('2026-10-07T08:00:00.000Z');
export const HOUR = 60 * 60 * 1000;

export function hoursFromNow(hours: number): Date {
  return new Date(NOW.getTime() + hours * HOUR);
}

export function channel(
  kind: ChannelKind,
  overrides: Partial<DisseminationChannelState> = {},
): DisseminationChannelState {
  return {
    channel: kind,
    state: 'SENT',
    recipients: 10,
    delivered: 10,
    attempts: 1,
    sentAt: NOW,
    ...overrides,
  };
}

/** A draft with everything filled in, ready to issue. */
export function warningEntity(
  overrides: Partial<HazardWarningEntity> = {},
): HazardWarningEntity {
  return {
    id: WARNING_ID,
    reference: 'HW-2026-0001',
    clientRequestId: CLIENT_REQUEST_ID,
    hazardType: 'FLOOD',
    level: 'HIGH',
    description: 'Heavy rainfall expected. Evacuate low-lying areas.',
    safetyInstructions: ['Move to higher ground immediately'],
    districts: ['COLOMBO', 'GAMPAHA'],
    validFrom: NOW,
    validUntil: hoursFromNow(12),
    status: 'DRAFT',
    channels: [],
    createdBy: OFFICER,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** A warning that went out on every channel. */
export function issuedWarning(
  overrides: Partial<HazardWarningEntity> = {},
): HazardWarningEntity {
  return warningEntity({
    status: 'DISSEMINATED',
    issuedBy: OFFICER,
    issuedAt: NOW,
    channels: [channel('PUSH'), channel('SMS'), channel('AUDIBLE')],
    ...overrides,
  });
}

export function citizen(overrides: Partial<CitizenEntity> = {}): CitizenEntity {
  return {
    id: '6700bb77bcf86cd799439011',
    deviceId: DEVICE_ID,
    district: 'COLOMBO',
    phone: '+94771234567',
    updatedAt: NOW,
    ...overrides,
  };
}

export function delivery(
  overrides: Partial<AlertDeliveryEntity> = {},
): AlertDeliveryEntity {
  return {
    id: '6700cc77bcf86cd799439011',
    warningId: WARNING_ID,
    deviceId: DEVICE_ID,
    deliveredAt: NOW,
    ...overrides,
  };
}
