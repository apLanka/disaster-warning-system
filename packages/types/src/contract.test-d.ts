import { REPORT_STATUS_LABELS } from './index.js';
import type {
  CreateHazardReportFields,
  HazardReportDto,
  HazardType,
  HealthResponse,
  NotificationDto,
  RejectReportInput,
} from './index.js';

const ok: HealthResponse = {
  status: 'ok',
  service: 'api',
  timestamp: '2026-01-01T00:00:00.000Z',
};
const degraded: HealthResponse = { ...ok, status: 'degraded' };

// @ts-expect-error status is a closed union
const bad: HealthResponse = { ...ok, status: 'unknown' };

const fields: CreateHazardReportFields = {
  clientRequestId: '7b0e6c0e-0f5e-4a52-9a77-3d3a0c1f9a11',
  type: 'FLOOD',
  description: 'Water level rising near the bridge',
  latitude: 7.2906,
  longitude: 80.6337,
};
const reject: RejectReportInput = { reason: 'OTHER', details: 'See notes' };
const pendingReport: HazardReportDto['status'] = 'PENDING_VERIFICATION';
const statusLabel: string = REPORT_STATUS_LABELS.PENDING_SYNC;

const noRequestId: CreateHazardReportFields = {
  ...fields,
  // @ts-expect-error clientRequestId is required for idempotent sync
  clientRequestId: undefined,
};
// @ts-expect-error hazard type is a closed union
const badType: CreateHazardReportFields = { ...fields, type: 'TORNADO' };
// @ts-expect-error rejection reason is a closed union
const badReason: RejectReportInput = { reason: 'BORED' };
// @ts-expect-error PENDING_SYNC lives on the device only, never on a stored report
const syncOnServer: HazardReportDto['status'] = 'PENDING_SYNC';
// @ts-expect-error every hazard type needs a label
const missingLabel: Record<HazardType, string> = { FLOOD: 'Flood' };
// @ts-expect-error notification kind is a closed union
const badKind: NotificationDto['kind'] = 'REPORT_PENDING';

export {
  ok,
  degraded,
  bad,
  fields,
  reject,
  pendingReport,
  statusLabel,
  noRequestId,
  badType,
  badReason,
  syncOnServer,
  missingLabel,
  badKind,
};

import {
  CHANNEL_KINDS,
  DISTRICTS,
  ISSUED_STATUSES,
  nearestDistrict,
  normalizeSriLankanMobile,
  WARNING_LEVEL_LABELS,
} from './index.js';
import type {
  CitizenAlertDto,
  CreateWarningInput,
  District,
  HazardWarningDto,
  WarningLevel,
} from './index.js';

const level: WarningLevel = 'HIGH';
// @ts-expect-error level is a closed union
const badLevel: WarningLevel = 'SEVERE';
const district: District = 'COLOMBO';
// @ts-expect-error districts are the 25 codes only
const badDistrict: District = 'Colombo';

const createInput: CreateWarningInput = {
  clientRequestId: '7b0e6c0e-0f5e-4a52-9a77-3d3a0c1f9a11',
  action: 'ISSUE',
  hazardType: 'FLOOD',
  level,
  districts: [district],
};
// @ts-expect-error action is DRAFT or ISSUE
const badAction: CreateWarningInput = { ...createInput, action: 'SEND' };

const warning: HazardWarningDto = {
  id: 'w1',
  reference: 'HW-2026-0001',
  hazardType: 'FLOOD',
  level,
  safetyInstructions: [],
  districts: [district],
  status: 'DRAFT',
  active: false,
  channels: [],
  createdBy: 'Officer Silva',
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
};

const citizenAlert: CitizenAlertDto = {
  id: 'w1',
  reference: 'HW-2026-0001',
  hazardType: 'FLOOD',
  level,
  districts: [district],
  description: 'Heavy rain',
  safetyInstructions: ['Move to higher ground'],
  issuedAt: '2026-10-07T00:00:00.000Z',
  validUntil: '2026-10-07T12:00:00.000Z',
  state: 'ACTIVE',
  acknowledgedAt: null,
};

const labels: string = WARNING_LEVEL_LABELS.CRITICAL;
const kinds: readonly string[] = CHANNEL_KINDS;
const issued: readonly string[] = ISSUED_STATUSES;
const allDistricts: number = DISTRICTS.length;
const nearest: District = nearestDistrict({ latitude: 6.93, longitude: 79.86 });
const phone: string | null = normalizeSriLankanMobile('077 123 4567');

export {
  badLevel,
  badDistrict,
  badAction,
  warning,
  citizenAlert,
  labels,
  kinds,
  issued,
  allDistricts,
  nearest,
  phone,
};
