import { REPORT_STATUS_LABELS } from './index.js';
import type {
  Alert,
  AnalysisScope,
  DistrictCode,
  EventStatus,
  PostDisasterReportDto,
  ResourceType,
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
const alert: Alert = {
  id: 'a1',
  severity: 'critical',
  message: 'Flood warning',
};

// @ts-expect-error status is a closed union
const bad: HealthResponse = { ...ok, status: 'unknown' };
// @ts-expect-error severity is a closed union
const badAlert: Alert = { ...alert, severity: 'urgent' };

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

const allDistricts: AnalysisScope = { kind: 'ALL' };
const oneDistrict: AnalysisScope = { kind: 'DISTRICT', districtCode: 'CMB' };
// @ts-expect-error a district scope needs a district
const noDistrict: AnalysisScope = { kind: 'DISTRICT' };
// @ts-expect-error district codes are a closed union
const badDistrict: DistrictCode = 'XXX';
// @ts-expect-error only ACTIVE and COMPLETED events exist
const badEventStatus: EventStatus = 'CANCELLED';
// @ts-expect-error every resource type needs a label
const missingResourceLabel: Record<ResourceType, string> = { WATER: 'Water' };
const completeness: PostDisasterReportDto['dataCompletenessStatus'] =
  'INCOMPLETE';

export {
  allDistricts,
  oneDistrict,
  noDistrict,
  badDistrict,
  badEventStatus,
  missingResourceLabel,
  completeness,
  ok,
  degraded,
  alert,
  bad,
  badAlert,
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
