import type { Alert, HealthResponse } from "./index.js";

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

export { ok, degraded, alert, bad, badAlert };
