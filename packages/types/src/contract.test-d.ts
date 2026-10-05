import { REPORT_STATUS_LABELS } from "./index.js";
import type {
  Alert,
  CreateHazardReportFields,
  HazardReportDto,
  HazardType,
  HealthResponse,
  NotificationDto,
  RejectReportInput,
} from "./index.js";

const ok: HealthResponse = {
  status: "ok",
  service: "api",
  timestamp: "2026-01-01T00:00:00.000Z",
};
const degraded: HealthResponse = { ...ok, status: "degraded" };
const alert: Alert = { id: "a1", severity: "critical", message: "Flood warning" };

// @ts-expect-error status is a closed union
const bad: HealthResponse = { ...ok, status: "unknown" };
// @ts-expect-error severity is a closed union
const badAlert: Alert = { ...alert, severity: "urgent" };

const fields: CreateHazardReportFields = {
  clientRequestId: "7b0e6c0e-0f5e-4a52-9a77-3d3a0c1f9a11",
  type: "FLOOD",
  description: "Water level rising near the bridge",
  latitude: 7.2906,
  longitude: 80.6337,
};
const reject: RejectReportInput = { reason: "OTHER", details: "See notes" };
const pendingReport: HazardReportDto["status"] = "PENDING_VERIFICATION";
const statusLabel: string = REPORT_STATUS_LABELS.PENDING_SYNC;

// @ts-expect-error clientRequestId is required for idempotent sync
const noRequestId: CreateHazardReportFields = { ...fields, clientRequestId: undefined };
// @ts-expect-error hazard type is a closed union
const badType: CreateHazardReportFields = { ...fields, type: "TORNADO" };
// @ts-expect-error rejection reason is a closed union
const badReason: RejectReportInput = { reason: "BORED" };
// @ts-expect-error PENDING_SYNC lives on the device only, never on a stored report
const syncOnServer: HazardReportDto["status"] = "PENDING_SYNC";
// @ts-expect-error every hazard type needs a label
const missingLabel: Record<HazardType, string> = { FLOOD: "Flood" };
// @ts-expect-error notification kind is a closed union
const badKind: NotificationDto["kind"] = "REPORT_PENDING";

export {
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
