# Issue and Disseminate Hazard Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An officer issues a hazard warning for districts from the DMC Portal (directly, from a draft, or from a verified report), it is sent by push (real, in-app), SMS and audible alert (simulated) to registered citizens, the officer sees and retries per-channel delivery and can cancel with an All Clear, and citizens see, acknowledge and get safety info on the phone.

**Architecture:** Two new Nest modules. `citizens/` owns citizen registration and alert deliveries. `hazard-warnings/` owns the warning lifecycle (command service), read models (query service), citizen alert views, and dissemination through a `NotificationChannel` strategy list. Shared DTOs and enums live in `@repo/types`. The portal gets four pages under `/warnings`, and the phone gets Profile, Alerts, Hazard Alert and Safety Info screens fed by an `AlertsProvider` that polls and caches.

**Tech Stack:** Bun workspaces + Turborepo, NestJS 12 (ESM) + Prisma 6.19.3 on MongoDB Atlas, Vitest + supertest; Vite + React 19 + React Router 7 + Tailwind 4 + react-leaflet; Expo 57 + React Navigation 7 + Jest/RNTL.

**Spec:** `docs/superpowers/specs/2026-10-07-hazard-warning-design.md`

## Global Constraints

- Commit messages: conventional commits scoped `types`, `api`, `web`, `mobile`, `docs`. **No `Co-Authored-By` or `Claude-Session` trailers.**
- Package manager: Bun. Never hand-edit `bun.lock`. No new dependencies are needed by this plan.
- Prisma stays pinned at exactly `6.19.3`. Schema changes go out with `bun run prisma:push` (and `prisma:push:test` for `dws_test`).
- API: every new import uses the `.js` suffix (ESM). Controllers stay thin; rules live in services; Prisma is touched only by `infrastructure/*` repositories injected by Symbol tokens.
- Shared contract: every DTO, enum and limit used by more than one app lives in `packages/types` and is rebuilt with `bun run --filter @repo/types build` before apps type-check.
- Colours: only existing tokens (`navy`, `orange`, `success`, `danger`, `warning-tint`, `warning-text`, tints). Level mapping: CRITICAL `danger`, HIGH `orange`, MEDIUM `warning-text` on `warning-tint`, LOW `success`.
- Copy that the spec fixes verbatim:
  - "No registered recipients found for the selected area."
  - "Notification service is temporarily unavailable."
  - "Warning could not be saved. Please try again."
  - "Please provide valid warning details before issuing the warning."
  - "Only verified reports can be escalated to a warning."
  - Emergency numbers: DMC Hotline 117, Police 119, Ambulance 110.
- Limits (`WARNING_LIMITS`): description 10-1000, additionalInfo ≤ 500, safety instructions 1-8 items of 3-200 chars, districts 1-25 unique, cancel reason 5-300, page size ≤ 50.
- Citizen alerts window: active warnings plus those cancelled or expired in the last 7 days.
- Portal status page polls every 3 s while `DISSEMINATING`; the phone polls alerts every 30 s and on focus / app foreground.
- Coverage: the existing 80% gates stay green; new folders `src/hazard-warnings/**` and `src/citizens/**` get the same 80% threshold. Aim above 90%.
- Lint runs with `--deny-warnings`; pre-commit formats with Prettier; pre-push type-checks. Never bypass hooks.

## Review Focus

1. **Double-click on Confirm / network retry of the same create** → must not issue twice. The `clientRequestId` replay returns the same warning (Task 6 test "replays a create with the same clientRequestId without sending again"; Task 4 integration test "returns the first warning when the same clientRequestId is created twice").
2. **Two officers act at once** (cancel vs cancel, issue a draft twice, retry while another retry runs) → exactly one wins, the other gets 409 with the current state, never a crash (Task 6 tests "cancel lost race returns 409…", "refuses when another officer already started a retry"; Task 4 integration test "lets exactly one of two concurrent cancels win").
3. **A channel throws or hangs-then-throws, or the citizen directory query itself fails** → the warning is still stored, other channels still send, status becomes PARTIALLY or PENDING, and the officer sees Retry (Task 5 tests "marks every channel failed when recipients cannot be looked up", "keeps sending on the other channels when one throws"; Task 11 test "flags a partial dissemination and retries").
4. **A citizen re-registers, changes district, or acknowledges twice / acknowledges an alert never delivered to them** → profile upserts, a second acknowledge is a no-op returning the same time, an unknown alert is 404 (Task 4 tests "falls back to an update when two first registrations race", integration "delivers to a device once and acknowledges once"; Task 6 test "404s a warning that was never delivered to this device").
5. **Officer leaves the review page by Back / refresh / direct URL** → typed entries are kept on Back; a direct visit to `/warnings/review` with no state redirects to the form instead of crashing (Task 10 tests "redirects to the form when opened directly", "Back keeps entries"; Task 9 test "restores the entries when coming back from review").

---

## File Map

### `packages/types/src`
- Create `districts.ts`: `DISTRICTS`, `District`, `DISTRICT_INFO`, `districtName`, `nearestDistrict`, `normalizeSriLankanMobile`.
- Create `hazard-warning.ts`: levels, statuses, channels, limits, all warning/citizen DTOs.
- Delete `alert.ts` (scaffold stub, unused by apps). Modify `index.ts`, `contract.test-d.ts`.

### `apps/api`
- Modify `prisma/schema.prisma`: enums, `DisseminationChannel` type, models `HazardWarning`, `NotificationLog`, `Citizen`, `AlertDelivery`.
- Create `src/prisma/references.ts` (shared `isUniqueViolation`, `nextReference`); modify `src/hazard-reports/infrastructure/prisma-hazard-report.repository.ts` to use it.
- Modify `src/config/env.ts` (+ spec): `SIMULATE_CHANNEL_FAILURE`. Modify `.env.example`.
- `src/citizens/`: `citizen.entity.ts`, `citizen-directory.ts`, `alert-delivery.repository.ts`, `infrastructure/prisma-citizen-directory.ts`, `infrastructure/prisma-alert-delivery.repository.ts`, `dto/register-citizen.dto.ts`, `citizens.service.ts`, `citizens.controller.ts`, `citizens.module.ts`, `testing.ts`, specs.
- `src/hazard-warnings/`:
  - `domain/hazard-warning.entity.ts`, `domain/warning-rules.ts` (pure rules), `domain/hazard-warning.mapper.ts`
  - `hazard-warning.repository.ts`, `notification-log.repository.ts`
  - `infrastructure/prisma-hazard-warning.repository.ts`, `infrastructure/prisma-notification-log.repository.ts`
  - `dissemination/notification-channel.ts`, `dissemination/channel-failure-switch.ts`, `dissemination/in-app-push.channel.ts`, `dissemination/sms.channel.ts`, `dissemination/audible-alert.channel.ts`, `dissemination/warning-disseminator.ts`
  - `dto/warning-fields.dto.ts`, `dto/create-warning.dto.ts`, `dto/warning-action.dtos.ts`, `dto/list-warnings-query.dto.ts`
  - `hazard-warnings.service.ts` (commands), `warning-queries.service.ts` (reads), `citizen-alerts.service.ts`
  - `hazard-warnings.controller.ts` (officer), `alerts.controller.ts` (citizen)
  - `hazard-warnings.module.ts`, `testing/fixtures.ts`, `testing/create-warnings-app.ts`, specs
- Modify `src/app.module.ts`, `vitest.config.ts` (thresholds). Create `test/hazard-warnings.e2e.spec.ts`.

### `apps/web/src`
- Modify `api/client.ts` (POST/PUT/DELETE, `toQueryString`, `describeError` overrides), `api/hazardReports.ts` (use shared `toQueryString`).
- Create `api/hazardWarnings.ts`.
- Create `lib/warningForm.ts`, `lib/warningLevels.ts`.
- Create `context/WarningStatsProvider.tsx`, `context/warningStatsContext.ts`, `hooks/useWarningStats.ts`.
- Modify `components/layout/navItems.ts`, `components/layout/DashboardLayout.tsx`, `components/reports/Pagination.tsx` (`noun` prop).
- Create `components/warnings/`: `LevelPicker.tsx`, `LevelChip.tsx`, `WarningStatusChip.tsx`, `DistrictPicker.tsx`, `DistrictMap.tsx`, `SafetyInstructionsField.tsx`, `ChannelCard.tsx`, `DeliveryActivity.tsx`.
- Create `pages/WarningFormPage.tsx`, `pages/ReviewWarningPage.tsx`, `pages/WarningStatusPage.tsx`, `pages/WarningsListPage.tsx` (+ tests).
- Modify `pages/ReviewReportPage.tsx` (escalate button), `App.tsx` (routes), `lib/routes.ts`, `test/fixtures.ts`, `App.test.tsx`, `test/a11y.test.tsx`, `components/layout/DashboardLayout.test.tsx`.

### `apps/mobile/src`
- Modify `api/client.ts` (JSON body, PUT).
- Create `api/alerts.ts`, `context/AlertsContext.tsx`, `lib/alerts.ts`.
- Create `components/LevelBadge.tsx`, `components/AlertCard.tsx`.
- Create `screens/ProfileScreen.tsx`, `screens/AlertsScreen.tsx`, `screens/HazardAlertScreen.tsx`, `screens/SafetyInfoScreen.tsx`, tests `screens/alerts.test.tsx`.
- Modify `navigation/types.ts`, `navigation/MainTabs.tsx`, `navigation/RootNavigator.tsx`, `screens/HomeScreen.tsx`, `App.tsx`, `test/utils.tsx`, `theme.ts` (no new colours; add `levelColors` map).

### `docs`
- Modify `style-guide.md` (warning level chips), `README.md` (warnings flow, `SIMULATE_CHANNEL_FAILURE`).
- Create `docs/critique/hazard-warning/critique.html`, `docs/critique/hazard-warning/revised-sequence.drawio`, `docs/critique/hazard-warning/screenshots/` (captured by hand).

---
### Task 1: Shared contract (`packages/types`)

**Files:**
- Create: `packages/types/src/districts.ts`, `packages/types/src/hazard-warning.ts`
- Delete: `packages/types/src/alert.ts`
- Modify: `packages/types/src/index.ts`, `packages/types/src/contract.test-d.ts`

**Interfaces:**
- Produces (used by every later task): `DISTRICTS`, `District`, `DISTRICT_INFO`, `districtName(d)`, `nearestDistrict(location): District`, `normalizeSriLankanMobile(input): string | null`, `WARNING_LEVELS`, `WarningLevel`, `WARNING_LEVEL_LABELS`, `WARNING_STATUSES`, `WarningStatus`, `WARNING_STATUS_LABELS`, `ISSUED_STATUSES`, `CHANNEL_KINDS`, `ChannelKind`, `CHANNEL_LABELS`, `ChannelState`, `MessageKind`, `WARNING_LIMITS`, `WarningView`, `WarningFields`, `CreateWarningInput`, `IssueWarningInput`, `CancelWarningInput`, `ListWarningsQuery`, `DisseminationStatusDto`, `HazardWarningDto`, `NotificationLogDto`, `HazardWarningDetailDto`, `WarningPreview`, `WarningStats`, `WarningPrefill`, `CitizenProfileDto`, `RegisterCitizenInput`, `CitizenAlertState`, `CitizenAlertDto`.

- [ ] **Step 1: Write the contract type test (fails: names do not exist)**

Replace the `Alert` parts of `packages/types/src/contract.test-d.ts`. Remove the `Alert` import, the `alert` and `badAlert` constants and their names from the final `export { ... }`. Then append:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `bun run --filter @repo/types check-types`
Expected: FAIL, `Module './index.js' has no exported member 'CHANNEL_KINDS'` (and similar).

- [ ] **Step 3: Create `packages/types/src/districts.ts`**

```ts
import type { GeoLocation } from './hazard-report.js';

/** Sri Lanka's 25 administrative districts. Codes are stored; names are shown. */
export const DISTRICTS = [
  'AMPARA',
  'ANURADHAPURA',
  'BADULLA',
  'BATTICALOA',
  'COLOMBO',
  'GALLE',
  'GAMPAHA',
  'HAMBANTOTA',
  'JAFFNA',
  'KALUTARA',
  'KANDY',
  'KEGALLE',
  'KILINOCHCHI',
  'KURUNEGALA',
  'MANNAR',
  'MATALE',
  'MATARA',
  'MONARAGALA',
  'MULLAITIVU',
  'NUWARA_ELIYA',
  'POLONNARUWA',
  'PUTTALAM',
  'RATNAPURA',
  'TRINCOMALEE',
  'VAVUNIYA',
] as const;

export type District = (typeof DISTRICTS)[number];

export interface DistrictInfo extends GeoLocation {
  name: string;
}

/** Display name, and the district capital's position used as the district centre on maps. */
export const DISTRICT_INFO: Record<District, DistrictInfo> = {
  AMPARA: { name: 'Ampara', latitude: 7.2975, longitude: 81.682 },
  ANURADHAPURA: { name: 'Anuradhapura', latitude: 8.3114, longitude: 80.4037 },
  BADULLA: { name: 'Badulla', latitude: 6.9934, longitude: 81.055 },
  BATTICALOA: { name: 'Batticaloa', latitude: 7.731, longitude: 81.6747 },
  COLOMBO: { name: 'Colombo', latitude: 6.9271, longitude: 79.8612 },
  GALLE: { name: 'Galle', latitude: 6.0535, longitude: 80.221 },
  GAMPAHA: { name: 'Gampaha', latitude: 7.084, longitude: 80.0098 },
  HAMBANTOTA: { name: 'Hambantota', latitude: 6.1241, longitude: 81.1185 },
  JAFFNA: { name: 'Jaffna', latitude: 9.6615, longitude: 80.0255 },
  KALUTARA: { name: 'Kalutara', latitude: 6.5854, longitude: 79.9607 },
  KANDY: { name: 'Kandy', latitude: 7.2906, longitude: 80.6337 },
  KEGALLE: { name: 'Kegalle', latitude: 7.2513, longitude: 80.3464 },
  KILINOCHCHI: { name: 'Kilinochchi', latitude: 9.3803, longitude: 80.377 },
  KURUNEGALA: { name: 'Kurunegala', latitude: 7.4863, longitude: 80.3623 },
  MANNAR: { name: 'Mannar', latitude: 8.981, longitude: 79.9044 },
  MATALE: { name: 'Matale', latitude: 7.4675, longitude: 80.6234 },
  MATARA: { name: 'Matara', latitude: 5.9549, longitude: 80.555 },
  MONARAGALA: { name: 'Monaragala', latitude: 6.8728, longitude: 81.3507 },
  MULLAITIVU: { name: 'Mullaitivu', latitude: 9.2671, longitude: 80.8142 },
  NUWARA_ELIYA: { name: 'Nuwara Eliya', latitude: 6.9497, longitude: 80.7891 },
  POLONNARUWA: { name: 'Polonnaruwa', latitude: 7.9403, longitude: 81.0188 },
  PUTTALAM: { name: 'Puttalam', latitude: 8.0362, longitude: 79.8283 },
  RATNAPURA: { name: 'Ratnapura', latitude: 6.6828, longitude: 80.3992 },
  TRINCOMALEE: { name: 'Trincomalee', latitude: 8.5874, longitude: 81.2152 },
  VAVUNIYA: { name: 'Vavuniya', latitude: 8.7514, longitude: 80.4971 },
};

export function districtName(district: District): string {
  return DISTRICT_INFO[district].name;
}

/**
 * The district whose centre is closest. Flat-earth distance with the
 * longitude scaled by latitude: accurate enough across a country this small.
 */
export function nearestDistrict({ latitude, longitude }: GeoLocation): District {
  const scale = Math.cos((latitude * Math.PI) / 180);
  let best: District = DISTRICTS[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const district of DISTRICTS) {
    const centre = DISTRICT_INFO[district];
    const dx = (centre.longitude - longitude) * scale;
    const dy = centre.latitude - latitude;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = district;
      bestDistance = distance;
    }
  }
  return best;
}

const SRI_LANKAN_MOBILE = /^(?:\+94|0094|0)?(7\d{8})$/;

/** "077 123 4567", "+94771234567", "0094-77-1234567" all become "+94771234567"; anything else is null. */
export function normalizeSriLankanMobile(input: string): string | null {
  const match = SRI_LANKAN_MOBILE.exec(input.replace(/[\s-]/g, ''));
  return match ? `+94${match[1]}` : null;
}
```

- [ ] **Step 4: Create `packages/types/src/hazard-warning.ts`**

```ts
import type { District } from './districts.js';
import type { HazardType } from './hazard-report.js';

export const WARNING_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type WarningLevel = (typeof WARNING_LEVELS)[number];

export const WARNING_LEVEL_LABELS: Record<WarningLevel, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const WARNING_STATUSES = [
  'DRAFT',
  'DISSEMINATING',
  'DISSEMINATED',
  'PARTIALLY_DISSEMINATED',
  'PENDING_DISSEMINATION',
  'CANCELLED',
] as const;
export type WarningStatus = (typeof WARNING_STATUSES)[number];

export const WARNING_STATUS_LABELS: Record<WarningStatus, string> = {
  DRAFT: 'Draft',
  DISSEMINATING: 'Disseminating',
  DISSEMINATED: 'Disseminated',
  PARTIALLY_DISSEMINATED: 'Partially Disseminated',
  PENDING_DISSEMINATION: 'Pending Dissemination',
  CANCELLED: 'Cancelled',
};

/** Statuses of a warning that has been issued and not cancelled. */
export const ISSUED_STATUSES = [
  'DISSEMINATING',
  'DISSEMINATED',
  'PARTIALLY_DISSEMINATED',
  'PENDING_DISSEMINATION',
] as const satisfies readonly WarningStatus[];

export const CHANNEL_KINDS = ['PUSH', 'SMS', 'AUDIBLE'] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];

export const CHANNEL_LABELS: Record<ChannelKind, string> = {
  PUSH: 'Push Notification',
  SMS: 'SMS',
  AUDIBLE: 'Audible Alert',
};

/** SKIPPED: the channel had nobody to reach (e.g. no citizen gave a phone number). */
export type ChannelState = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

export type MessageKind = 'WARNING' | 'ALL_CLEAR';

export const WARNING_LIMITS = {
  descriptionMin: 10,
  descriptionMax: 1000,
  additionalInfoMax: 500,
  instructionsMax: 8,
  instructionMin: 3,
  instructionMax: 200,
  districtsMax: 25,
  cancelReasonMin: 5,
  cancelReasonMax: 300,
  pageSizeMax: 50,
} as const;

export type WarningView = 'active' | 'drafts' | 'past';

/** What the officer fills in. A draft needs only type, level and districts. */
export interface WarningFields {
  hazardType: HazardType;
  level: WarningLevel;
  districts: District[];
  description?: string;
  additionalInfo?: string;
  safetyInstructions?: string[];
  /** ISO 8601. Defaults to the issue time. */
  validFrom?: string;
  /** ISO 8601. Required to issue. */
  validUntil?: string;
  /** Set when the warning was started from a verified hazard report. */
  sourceReportId?: string;
}

export interface CreateWarningInput extends WarningFields {
  clientRequestId: string;
  action: 'DRAFT' | 'ISSUE';
  /** Issue even though an active warning already covers the same hazard and district. */
  force?: boolean;
}

export interface IssueWarningInput {
  force?: boolean;
}

export interface CancelWarningInput {
  reason: string;
}

export interface ListWarningsQuery {
  view?: WarningView;
  page?: number;
  limit?: number;
}

export interface DisseminationStatusDto {
  channel: ChannelKind;
  state: ChannelState;
  recipients: number;
  delivered: number;
  attempts: number;
  lastError?: string;
  sentAt?: string;
}

export interface WarningCancellation {
  cancelledAt: string;
  cancelledBy: string;
  reason: string;
}

export interface HazardWarningDto {
  id: string;
  /** Human-readable id, e.g. "HW-2026-0007". */
  reference: string;
  hazardType: HazardType;
  level: WarningLevel;
  description?: string;
  additionalInfo?: string;
  safetyInstructions: string[];
  districts: District[];
  validFrom?: string;
  validUntil?: string;
  sourceReportId?: string;
  status: WarningStatus;
  /** Issued, not cancelled, and not yet past validUntil. */
  active: boolean;
  channels: DisseminationStatusDto[];
  createdBy: string;
  issuedBy?: string;
  issuedAt?: string;
  cancellation?: WarningCancellation;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLogDto {
  id: string;
  channel: ChannelKind;
  kind: MessageKind;
  outcome: 'SENT' | 'FAILED';
  message: string;
  recipients: number;
  createdAt: string;
}

export interface HazardWarningDetailDto extends HazardWarningDto {
  /** Newest first, at most 50. */
  logs: NotificationLogDto[];
  /** Citizens who tapped Acknowledge. */
  acknowledged: number;
}

export interface WarningPreview {
  recipients: {
    total: number;
    withPhone: number;
    byDistrict: Partial<Record<District, number>>;
  };
  /** Active warnings for the same hazard type in any of the same districts. */
  duplicates: HazardWarningDto[];
}

export interface WarningStats {
  active: number;
  drafts: number;
  issuedToday: number;
}

export interface WarningPrefill {
  hazardType: HazardType;
  districts: District[];
  description: string;
  sourceReportId: string;
  reportReference: string;
}

export interface RegisterCitizenInput {
  district: District;
  /** Sri Lankan mobile, for SMS warnings. */
  phone?: string;
}

export interface CitizenProfileDto {
  district: District;
  phone?: string;
  updatedAt: string;
}

export type CitizenAlertState = 'ACTIVE' | 'ALL_CLEAR' | 'EXPIRED';

/** A warning as one citizen sees it. Officer names and internal fields are left out. */
export interface CitizenAlertDto {
  /** The warning id. */
  id: string;
  reference: string;
  hazardType: HazardType;
  level: WarningLevel;
  districts: District[];
  description: string;
  safetyInstructions: string[];
  issuedAt: string;
  validUntil: string;
  state: CitizenAlertState;
  /** Why the officer cancelled it; present when state is ALL_CLEAR. */
  cancelReason?: string;
  acknowledgedAt: string | null;
}
```

- [ ] **Step 5: Update `packages/types/src/index.ts` and delete `alert.ts`**

```ts
export * from './districts.js';
export * from './hazard-report.js';
export * from './hazard-warning.js';
export * from './health.js';
```

Run: `git rm packages/types/src/alert.ts && grep -rn "from '@repo/types'" apps | grep -w Alert`
Expected: no output (no app imports `Alert`).

- [ ] **Step 6: Type-check and build**

Run: `bun run --filter @repo/types check-types && bun run --filter @repo/types build && bun run check-types`
Expected: all PASS; `packages/types/dist/hazard-warning.d.ts` exists.

- [ ] **Step 7: Commit**

```bash
git add packages/types
git commit -m "feat(types): add hazard warning and district contract"
```

---
### Task 2: Schema, configuration and shared reference counter (`apps/api`)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/src/config/env.ts`, `apps/api/src/config/env.spec.ts`, `apps/api/.env.example`, `apps/api/src/hazard-reports/infrastructure/prisma-hazard-report.repository.ts`
- Create: `apps/api/src/prisma/references.ts`, `apps/api/src/prisma/references.spec.ts`

**Interfaces:**
- Consumes: `CHANNEL_KINDS`, `ChannelKind` from Task 1.
- Produces: Prisma models `hazardWarning`, `notificationLog`, `citizen`, `alertDelivery`; `Env.SIMULATE_CHANNEL_FAILURE: ChannelKind[]`; `isUniqueViolation(error, field): boolean`; `nextReference(prisma: PrismaService, prefix: 'HR' | 'HW', now?: Date): Promise<string>`.

- [ ] **Step 1: Add the models to `apps/api/prisma/schema.prisma`** (append below `Counter`)

```prisma
enum WarningLevel {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum WarningStatus {
  DRAFT
  DISSEMINATING
  DISSEMINATED
  PARTIALLY_DISSEMINATED
  PENDING_DISSEMINATION
  CANCELLED
}

enum ChannelKind {
  PUSH
  SMS
  AUDIBLE
}

enum ChannelState {
  PENDING
  SENT
  FAILED
  SKIPPED
}

enum MessageKind {
  WARNING
  ALL_CLEAR
}

enum LogOutcome {
  SENT
  FAILED
}

type DisseminationChannel {
  channel    ChannelKind
  state      ChannelState
  recipients Int
  delivered  Int
  attempts   Int
  lastError  String?
  sentAt     DateTime?
}

// districts holds District codes from @repo/types; the DTO validates them on write.
model HazardWarning {
  id                 String                 @id @default(auto()) @map("_id") @db.ObjectId
  reference          String                 @unique
  clientRequestId    String                 @unique
  hazardType         HazardType
  level              WarningLevel
  description        String?
  additionalInfo     String?
  safetyInstructions String[]
  districts          String[]
  validFrom          DateTime?
  validUntil         DateTime?
  sourceReportId     String?                @db.ObjectId
  status             WarningStatus          @default(DRAFT)
  channels           DisseminationChannel[]
  createdBy          String
  issuedBy           String?
  issuedAt           DateTime?
  cancelledAt        DateTime?
  cancelledBy        String?
  cancelReason       String?
  createdAt          DateTime               @default(now())
  updatedAt          DateTime               @updatedAt

  @@index([status, createdAt])
  @@index([districts, status])
  @@map("hazard_warnings")
}

// One row per channel attempt, including All Clear sends. Feeds Live Delivery Activity.
model NotificationLog {
  id         String      @id @default(auto()) @map("_id") @db.ObjectId
  warningId  String      @db.ObjectId
  channel    ChannelKind
  kind       MessageKind
  outcome    LogOutcome
  message    String
  recipients Int
  createdAt  DateTime    @default(now())

  @@index([warningId, createdAt])
  @@map("notification_logs")
}

// A citizen's alert area. deviceId is the same UUID the app sends as x-reporter-id.
model Citizen {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  deviceId  String   @unique
  district  String
  phone     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([district])
  @@map("citizens")
}

// One row per citizen per warning: the in-app push. Unique so a retry never delivers twice.
model AlertDelivery {
  id             String    @id @default(auto()) @map("_id") @db.ObjectId
  warningId      String    @db.ObjectId
  deviceId       String
  deliveredAt    DateTime  @default(now())
  acknowledgedAt DateTime?

  @@unique([warningId, deviceId])
  @@index([deviceId, deliveredAt])
  @@map("alert_deliveries")
}
```

Run: `cd apps/api && bunx prisma validate && bunx prisma generate`
Expected: "The schema is valid", client generated.

- [ ] **Step 2: Write failing env tests** (append inside the existing `describe` in `apps/api/src/config/env.spec.ts`; reuse that file's existing valid-config object, called `valid` below — rename to match the file)

```ts
  describe('SIMULATE_CHANNEL_FAILURE', () => {
    it('defaults to no simulated failures', () => {
      expect(validateEnv(valid).SIMULATE_CHANNEL_FAILURE).toEqual([]);
    });

    it('reads a comma list in any case and spacing', () => {
      const env = validateEnv({
        ...valid,
        SIMULATE_CHANNEL_FAILURE: ' sms, Audible ',
      });
      expect(env.SIMULATE_CHANNEL_FAILURE).toEqual(['SMS', 'AUDIBLE']);
    });

    it('rejects an unknown channel', () => {
      expect(() =>
        validateEnv({ ...valid, SIMULATE_CHANNEL_FAILURE: 'SMS,FAX' }),
      ).toThrow('SIMULATE_CHANNEL_FAILURE has unknown channel FAX');
    });
  });
```

Run: `cd apps/api && bunx vitest run src/config/env.spec.ts`
Expected: FAIL (`SIMULATE_CHANNEL_FAILURE` is undefined).

- [ ] **Step 3: Implement in `apps/api/src/config/env.ts`**

Add `import { CHANNEL_KINDS, type ChannelKind } from '@repo/types';` at the top, add `SIMULATE_CHANNEL_FAILURE: ChannelKind[];` to `Env`, and add this helper above `validateEnv`:

```ts
/** Channels whose simulated gateway should fail, for demonstrating partial dissemination. */
function readFailingChannels(
  config: Record<string, unknown>,
  errors: string[],
): ChannelKind[] {
  const raw = readString(config, 'SIMULATE_CHANNEL_FAILURE');
  if (raw === undefined) return [];

  const kinds: ChannelKind[] = [];
  for (const part of raw.split(',')) {
    const name = part.trim().toUpperCase();
    if (name === '') continue;
    if ((CHANNEL_KINDS as readonly string[]).includes(name)) {
      kinds.push(name as ChannelKind);
    } else {
      errors.push(`SIMULATE_CHANNEL_FAILURE has unknown channel ${name}`);
    }
  }
  return kinds;
}
```

In `validateEnv`, before the `if (errors.length > 0)` line add `const failingChannels = readFailingChannels(config, errors);` and add `SIMULATE_CHANNEL_FAILURE: failingChannels,` to the returned object.

Append to `apps/api/.env.example`:

```sh

# Optional. Comma list of PUSH, SMS, AUDIBLE whose simulated gateway should fail,
# to demonstrate partial dissemination and retry. Leave empty normally.
SIMULATE_CHANNEL_FAILURE=
```

Run: `cd apps/api && bunx vitest run src/config/env.spec.ts`
Expected: PASS.

- [ ] **Step 4: Write failing tests for the shared reference counter** — `apps/api/src/prisma/references.spec.ts`

```ts
import { Prisma } from '@prisma/client';

import type { PrismaService } from './prisma.service.js';
import { isUniqueViolation, nextReference } from './references.js';

function uniqueError(field: string) {
  return new Prisma.PrismaClientKnownRequestError(`Unique on ${field}`, {
    code: 'P2002',
    clientVersion: '6.19.3',
    meta: { target: field },
  });
}

function fakePrisma() {
  return { counter: { upsert: vi.fn() } };
}

describe('isUniqueViolation', () => {
  it('matches a P2002 on the named field only', () => {
    expect(isUniqueViolation(uniqueError('clientRequestId'), 'clientRequestId')).toBe(true);
    expect(isUniqueViolation(uniqueError('reference'), 'clientRequestId')).toBe(false);
    expect(isUniqueViolation(new Error('boom'), 'clientRequestId')).toBe(false);
  });
});

describe('nextReference', () => {
  it('formats prefix, year and a zero-padded sequence', async () => {
    const prisma = fakePrisma();
    prisma.counter.upsert.mockResolvedValue({ id: 'HW-2026', seq: 7 });

    const reference = await nextReference(
      prisma as unknown as PrismaService,
      'HW',
      new Date('2026-10-07T00:00:00Z'),
    );

    expect(reference).toBe('HW-2026-0007');
    expect(prisma.counter.upsert).toHaveBeenCalledWith({
      where: { id: 'HW-2026' },
      create: { id: 'HW-2026', seq: 1 },
      update: { seq: { increment: 1 } },
    });
  });

  it('retries once when two first requests race to create the counter', async () => {
    const prisma = fakePrisma();
    prisma.counter.upsert
      .mockRejectedValueOnce(uniqueError('id'))
      .mockResolvedValueOnce({ id: 'HR-2026', seq: 2 });

    await expect(
      nextReference(prisma as unknown as PrismaService, 'HR', new Date('2026-01-01T00:00:00Z')),
    ).resolves.toBe('HR-2026-0002');
  });

  it('gives up after the second failed attempt', async () => {
    const prisma = fakePrisma();
    prisma.counter.upsert.mockRejectedValue(uniqueError('id'));

    await expect(nextReference(prisma as unknown as PrismaService, 'HW')).rejects.toThrow();
    expect(prisma.counter.upsert).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors', async () => {
    const prisma = fakePrisma();
    prisma.counter.upsert.mockRejectedValue(new Error('network'));

    await expect(nextReference(prisma as unknown as PrismaService, 'HW')).rejects.toThrow('network');
    expect(prisma.counter.upsert).toHaveBeenCalledTimes(1);
  });
});
```

Run: `cd apps/api && bunx vitest run src/prisma/references.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 5: Create `apps/api/src/prisma/references.ts`** by moving the two helpers out of the reports repository

```ts
import { Prisma } from '@prisma/client';

import type { PrismaService } from './prisma.service.js';

const REFERENCE_ATTEMPTS = 2;

export function isUniqueViolation(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    `${JSON.stringify(error.meta ?? {})} ${error.message}`.includes(field)
  );
}

/** Hands out <prefix>-<year>-<0001...> from one atomic counter per prefix and year. */
export async function nextReference(
  prisma: PrismaService,
  prefix: 'HR' | 'HW',
  now = new Date(),
): Promise<string> {
  const key = `${prefix}-${now.getUTCFullYear()}`;

  for (let attempt = 1; ; attempt++) {
    try {
      const counter = await prisma.counter.upsert({
        where: { id: key },
        create: { id: key, seq: 1 },
        update: { seq: { increment: 1 } },
      });
      return `${key}-${String(counter.seq).padStart(4, '0')}`;
    } catch (error) {
      // Two first-ever requests can race to create the counter row.
      const lostCreateRace = isUniqueViolation(error, 'id');
      if (!lostCreateRace || attempt >= REFERENCE_ATTEMPTS) throw error;
    }
  }
}
```

In `prisma-hazard-report.repository.ts`: delete the local `isUniqueViolation`, `REFERENCE_ATTEMPTS` and the private `nextReference` method; import `{ isUniqueViolation, nextReference } from '../../prisma/references.js'`; replace `const reference = await this.nextReference();` with `const reference = await nextReference(this.prisma, 'HR');`; drop the now-unused `Prisma` value import if the file no longer uses it (keep the `type` import used by `HazardReportWhereInput`).

- [ ] **Step 6: Run the API unit suite**

Run: `cd apps/api && bunx vitest run --project unit && bun run check-types && bun run lint`
Expected: all PASS (existing report repository tests still pass through the shared helper).

- [ ] **Step 7: Push the schema and commit**

Run: `cd apps/api && bun run prisma:push && bun run prisma:push:test`
Expected: "Your database is now in sync with your Prisma schema" twice.

```bash
git add apps/api/prisma/schema.prisma apps/api/src/config apps/api/.env.example apps/api/src/prisma apps/api/src/hazard-reports/infrastructure/prisma-hazard-report.repository.ts
git commit -m "feat(api): add warning, citizen and delivery schema and channel failure config"
```

---

### Task 3: Warning domain rules and mapping (`apps/api/src/hazard-warnings/domain`)

Pure functions only: no Nest, no Prisma. Everything here is unit-tested directly.

**Files:**
- Create: `apps/api/src/hazard-warnings/domain/hazard-warning.entity.ts`, `domain/warning-rules.ts`, `domain/warning-rules.spec.ts`, `domain/hazard-warning.mapper.ts`, `domain/hazard-warning.mapper.spec.ts`, `apps/api/src/hazard-warnings/testing/fixtures.ts`
- Create: `apps/api/src/citizens/citizen.entity.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces:
  - `DisseminationChannelState`, `WarningContent`, `HazardWarningEntity`, `NotificationLogEntity` (entity file)
  - `CitizenEntity { id; deviceId; district: District; phone?: string; updatedAt: Date }`, `AlertDeliveryEntity { id; warningId; deviceId; deliveredAt: Date; acknowledgedAt?: Date }` (citizen entity file)
  - `RETRYABLE_STATUSES`, `isIssued(status)`, `isActive(w, now)`, `initialChannels()`, `mergeChannels(current, updates)`, `overallStatus(channels)`, `retryableChannels(channels)`, `contentProblems(content)`, `issueProblems(content, now)`, `citizenAlertState(w, now)`, `describeDistricts(districts)`, `warningMessage(w)`, `allClearMessage(w)`
  - `toHazardWarningDto(w, now)`, `toHazardWarningDetailDto(w, logs, acknowledged, now)`, `toNotificationLogDto(log)`, `toCitizenAlertDto(w, delivery, state)`
  - Fixtures: `WARNING_ID`, `OTHER_WARNING_ID`, `DEVICE_ID`, `NOW`, `warningEntity(overrides)`, `issuedWarning(overrides)`, `channel(kind, overrides)`, `delivery(overrides)`, `citizen(overrides)`

- [ ] **Step 1: Create the entities**

`apps/api/src/hazard-warnings/domain/hazard-warning.entity.ts`:

```ts
import type {
  ChannelKind,
  ChannelState,
  District,
  HazardType,
  MessageKind,
  WarningLevel,
  WarningStatus,
} from '@repo/types';

export interface DisseminationChannelState {
  channel: ChannelKind;
  state: ChannelState;
  recipients: number;
  delivered: number;
  attempts: number;
  lastError?: string;
  sentAt?: Date;
}

/** What the officer controls. Everything else is set by the lifecycle. */
export interface WarningContent {
  hazardType: HazardType;
  level: WarningLevel;
  description?: string;
  additionalInfo?: string;
  safetyInstructions: string[];
  districts: District[];
  validFrom?: Date;
  validUntil?: Date;
  sourceReportId?: string;
}

export interface WarningCancellationRecord {
  cancelledAt: Date;
  cancelledBy: string;
  reason: string;
}

/** Plain state with no behaviour: rules live in warning-rules and the services. */
export interface HazardWarningEntity extends WarningContent {
  id: string;
  reference: string;
  clientRequestId: string;
  status: WarningStatus;
  channels: DisseminationChannelState[];
  createdBy: string;
  issuedBy?: string;
  issuedAt?: Date;
  cancellation?: WarningCancellationRecord;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationLogEntity {
  id: string;
  warningId: string;
  channel: ChannelKind;
  kind: MessageKind;
  outcome: 'SENT' | 'FAILED';
  message: string;
  recipients: number;
  createdAt: Date;
}
```

`apps/api/src/citizens/citizen.entity.ts`:

```ts
import type { District } from '@repo/types';

export interface CitizenEntity {
  id: string;
  deviceId: string;
  district: District;
  phone?: string;
  updatedAt: Date;
}

/** One warning delivered in-app to one device. */
export interface AlertDeliveryEntity {
  id: string;
  warningId: string;
  deviceId: string;
  deliveredAt: Date;
  acknowledgedAt?: Date;
}
```

- [ ] **Step 2: Create test fixtures** — `apps/api/src/hazard-warnings/testing/fixtures.ts`

```ts
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
```

- [ ] **Step 3: Write failing rule tests** — `apps/api/src/hazard-warnings/domain/warning-rules.spec.ts`

```ts
import {
  channel,
  hoursFromNow,
  issuedWarning,
  NOW,
  warningEntity,
} from '../testing/fixtures.js';
import {
  allClearMessage,
  citizenAlertState,
  contentProblems,
  describeDistricts,
  initialChannels,
  isActive,
  issueProblems,
  mergeChannels,
  overallStatus,
  retryableChannels,
  warningMessage,
} from './warning-rules.js';

describe('isActive', () => {
  it('is true for an issued warning before validUntil', () => {
    expect(isActive(issuedWarning(), NOW)).toBe(true);
  });

  it.each(['DRAFT', 'CANCELLED'] as const)('is false for %s', (status) => {
    expect(isActive(issuedWarning({ status }), NOW)).toBe(false);
  });

  it('is false once validUntil has passed, and exactly at validUntil', () => {
    expect(isActive(issuedWarning({ validUntil: hoursFromNow(-1) }), NOW)).toBe(false);
    expect(isActive(issuedWarning({ validUntil: NOW }), NOW)).toBe(false);
  });
});

describe('overallStatus', () => {
  it('is DISSEMINATED when every channel sent or had nobody to reach', () => {
    expect(
      overallStatus([channel('PUSH'), channel('SMS', { state: 'SKIPPED' }), channel('AUDIBLE')]),
    ).toBe('DISSEMINATED');
  });

  it('is PARTIALLY_DISSEMINATED when one channel failed and another sent', () => {
    expect(
      overallStatus([channel('PUSH'), channel('SMS', { state: 'FAILED' }), channel('AUDIBLE')]),
    ).toBe('PARTIALLY_DISSEMINATED');
  });

  it('is PENDING_DISSEMINATION when nothing was sent', () => {
    expect(
      overallStatus([
        channel('PUSH', { state: 'FAILED' }),
        channel('SMS', { state: 'SKIPPED' }),
        channel('AUDIBLE', { state: 'PENDING' }),
      ]),
    ).toBe('PENDING_DISSEMINATION');
  });
});

describe('initialChannels and mergeChannels', () => {
  it('starts every channel as PENDING with no attempts, in channel order', () => {
    expect(initialChannels()).toEqual([
      { channel: 'PUSH', state: 'PENDING', recipients: 0, delivered: 0, attempts: 0 },
      { channel: 'SMS', state: 'PENDING', recipients: 0, delivered: 0, attempts: 0 },
      { channel: 'AUDIBLE', state: 'PENDING', recipients: 0, delivered: 0, attempts: 0 },
    ]);
  });

  it('replaces only the channels that were re-sent', () => {
    const current = [channel('PUSH'), channel('SMS', { state: 'FAILED' }), channel('AUDIBLE')];
    const retried = channel('SMS', { attempts: 2 });

    expect(mergeChannels(current, [retried])).toEqual([current[0], retried, current[2]]);
  });
});

describe('retryableChannels', () => {
  it('lists FAILED and PENDING channels only', () => {
    expect(
      retryableChannels([
        channel('PUSH'),
        channel('SMS', { state: 'FAILED' }),
        channel('AUDIBLE', { state: 'PENDING' }),
      ]),
    ).toEqual(['SMS', 'AUDIBLE']);
  });
});

describe('contentProblems and issueProblems', () => {
  it('accepts a complete warning', () => {
    expect(issueProblems(warningEntity(), NOW)).toEqual([]);
  });

  it('rejects a period that ends before it starts, even for a draft', () => {
    const content = warningEntity({ validFrom: hoursFromNow(2), validUntil: hoursFromNow(1) });
    expect(contentProblems(content)).toEqual(['validUntil must be after validFrom']);
  });

  it('lists everything missing before a warning can be issued', () => {
    const content = warningEntity({
      description: undefined,
      safetyInstructions: [],
      validUntil: undefined,
    });

    expect(issueProblems(content, NOW)).toEqual([
      'description is required to issue a warning',
      'add at least one safety instruction',
      'validUntil is required to issue a warning',
    ]);
  });

  it('refuses to issue a warning that has already expired', () => {
    const content = warningEntity({ validFrom: undefined, validUntil: hoursFromNow(-1) });
    expect(issueProblems(content, NOW)).toEqual(['validUntil must be in the future']);
  });
});

describe('citizenAlertState', () => {
  it('is ACTIVE while the warning is active', () => {
    expect(citizenAlertState(issuedWarning(), NOW)).toBe('ACTIVE');
  });

  it('is ALL_CLEAR for a recent cancellation and hidden after 7 days', () => {
    const cancelled = (hoursAgo: number) =>
      issuedWarning({
        status: 'CANCELLED',
        cancellation: { cancelledAt: hoursFromNow(-hoursAgo), cancelledBy: 'Officer Silva', reason: 'Water receded' },
      });

    expect(citizenAlertState(cancelled(1), NOW)).toBe('ALL_CLEAR');
    expect(citizenAlertState(cancelled(24 * 8), NOW)).toBeNull();
  });

  it('is EXPIRED for a recent expiry and hidden after 7 days', () => {
    expect(citizenAlertState(issuedWarning({ validUntil: hoursFromNow(-2) }), NOW)).toBe('EXPIRED');
    expect(citizenAlertState(issuedWarning({ validUntil: hoursFromNow(-24 * 8) }), NOW)).toBeNull();
  });

  it('never shows a draft', () => {
    expect(citizenAlertState(warningEntity(), NOW)).toBeNull();
  });
});

describe('messages', () => {
  it('names the districts in reading form', () => {
    expect(describeDistricts(['COLOMBO', 'NUWARA_ELIYA'])).toBe('Colombo, Nuwara Eliya');
  });

  it('builds the warning text sent on every channel', () => {
    expect(warningMessage(issuedWarning())).toBe(
      'HIGH Flood warning for Colombo, Gampaha (HW-2026-0001): Heavy rainfall expected. Evacuate low-lying areas.',
    );
  });

  it('builds the All Clear text with the officer reason', () => {
    const cancelled = issuedWarning({
      status: 'CANCELLED',
      cancellation: { cancelledAt: NOW, cancelledBy: 'Officer Silva', reason: 'Water has receded' },
    });
    expect(allClearMessage(cancelled)).toBe(
      'ALL CLEAR: the Flood warning HW-2026-0001 for Colombo, Gampaha has been lifted. Water has receded',
    );
  });
});
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings/domain`
Expected: FAIL (module `./warning-rules.js` not found).

- [ ] **Step 4: Implement `apps/api/src/hazard-warnings/domain/warning-rules.ts`**

```ts
import {
  CHANNEL_KINDS,
  districtName,
  HAZARD_TYPE_LABELS,
  ISSUED_STATUSES,
  type CitizenAlertState,
  type ChannelKind,
  type District,
  type WarningStatus,
} from '@repo/types';

import type {
  DisseminationChannelState,
  HazardWarningEntity,
  WarningContent,
} from './hazard-warning.entity.js';

/** A failed or never-sent channel can be sent again only from these statuses. */
export const RETRYABLE_STATUSES = [
  'PARTIALLY_DISSEMINATED',
  'PENDING_DISSEMINATION',
] as const satisfies readonly WarningStatus[];

/** How long a citizen keeps seeing a cancelled or expired warning. */
export const CITIZEN_HISTORY_MS = 7 * 24 * 60 * 60 * 1000;

export function isIssued(status: WarningStatus): boolean {
  return (ISSUED_STATUSES as readonly WarningStatus[]).includes(status);
}

export function isActive(
  warning: Pick<HazardWarningEntity, 'status' | 'validUntil'>,
  now: Date,
): boolean {
  return (
    isIssued(warning.status) &&
    warning.validUntil !== undefined &&
    warning.validUntil.getTime() > now.getTime()
  );
}

export function initialChannels(): DisseminationChannelState[] {
  return CHANNEL_KINDS.map((channel) => ({
    channel,
    state: 'PENDING',
    recipients: 0,
    delivered: 0,
    attempts: 0,
  }));
}

/** Keeps channel order fixed and replaces only the channels in `updates`. */
export function mergeChannels(
  current: DisseminationChannelState[],
  updates: DisseminationChannelState[],
): DisseminationChannelState[] {
  const pending = initialChannels();
  return CHANNEL_KINDS.map(
    (kind) =>
      updates.find((item) => item.channel === kind) ??
      current.find((item) => item.channel === kind) ??
      pending.find((item) => item.channel === kind)!,
  );
}

/**
 * The scenario's overall status: all reached (or nobody to reach), some
 * reached (Partially Disseminated), or nothing reached (Pending Dissemination).
 */
export function overallStatus(
  channels: DisseminationChannelState[],
): WarningStatus {
  const sent = channels.some((item) => item.state === 'SENT');
  const unfinished = channels.some(
    (item) => item.state === 'FAILED' || item.state === 'PENDING',
  );
  if (!unfinished) return 'DISSEMINATED';
  return sent ? 'PARTIALLY_DISSEMINATED' : 'PENDING_DISSEMINATION';
}

export function retryableChannels(
  channels: DisseminationChannelState[],
): ChannelKind[] {
  return channels
    .filter((item) => item.state === 'FAILED' || item.state === 'PENDING')
    .map((item) => item.channel);
}

/** Problems that make even a draft invalid. */
export function contentProblems(content: WarningContent): string[] {
  const { validFrom, validUntil } = content;
  if (validFrom && validUntil && validUntil.getTime() <= validFrom.getTime()) {
    return ['validUntil must be after validFrom'];
  }
  return [];
}

/** Everything that stops a warning from being issued, in form order. */
export function issueProblems(content: WarningContent, now: Date): string[] {
  const problems = contentProblems(content);
  if (!content.description) {
    problems.push('description is required to issue a warning');
  }
  if (content.safetyInstructions.length === 0) {
    problems.push('add at least one safety instruction');
  }
  if (!content.validUntil) {
    problems.push('validUntil is required to issue a warning');
  } else if (content.validUntil.getTime() <= now.getTime()) {
    problems.push('validUntil must be in the future');
  }
  return problems;
}

/** What a citizen sees, or null when the warning should not be shown at all. */
export function citizenAlertState(
  warning: HazardWarningEntity,
  now: Date,
): CitizenAlertState | null {
  if (!warning.issuedAt || !warning.validUntil) return null;
  const cutoff = now.getTime() - CITIZEN_HISTORY_MS;

  if (warning.status === 'CANCELLED') {
    const cancelledAt = warning.cancellation?.cancelledAt.getTime() ?? 0;
    return cancelledAt >= cutoff ? 'ALL_CLEAR' : null;
  }
  if (!isIssued(warning.status)) return null;
  if (isActive(warning, now)) return 'ACTIVE';
  return warning.validUntil.getTime() >= cutoff ? 'EXPIRED' : null;
}

export function describeDistricts(districts: District[]): string {
  return districts.map(districtName).join(', ');
}

/** The text every channel carries: short enough for one SMS when the description is short. */
export function warningMessage(warning: HazardWarningEntity): string {
  const hazard = HAZARD_TYPE_LABELS[warning.hazardType];
  return `${warning.level} ${hazard} warning for ${describeDistricts(warning.districts)} (${warning.reference}): ${warning.description ?? ''}`.trim();
}

export function allClearMessage(warning: HazardWarningEntity): string {
  const hazard = HAZARD_TYPE_LABELS[warning.hazardType];
  const reason = warning.cancellation?.reason ?? '';
  return `ALL CLEAR: the ${hazard} warning ${warning.reference} for ${describeDistricts(warning.districts)} has been lifted. ${reason}`.trim();
}
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings/domain/warning-rules.spec.ts`
Expected: PASS. (`HAZARD_TYPE_LABELS.FLOOD` is `'Flood'` in `@repo/types`; check the label table if the message test fails and fix the expected text, not the code.)

- [ ] **Step 5: Write failing mapper tests** — `apps/api/src/hazard-warnings/domain/hazard-warning.mapper.spec.ts`

```ts
import {
  delivery,
  issuedWarning,
  NOW,
  warningEntity,
} from '../testing/fixtures.js';
import {
  toCitizenAlertDto,
  toHazardWarningDetailDto,
  toHazardWarningDto,
} from './hazard-warning.mapper.js';

describe('toHazardWarningDto', () => {
  it('serialises dates and marks an issued warning active', () => {
    const dto = toHazardWarningDto(issuedWarning(), NOW);

    expect(dto).toMatchObject({
      id: issuedWarning().id,
      status: 'DISSEMINATED',
      active: true,
      issuedAt: NOW.toISOString(),
      validUntil: '2026-10-07T20:00:00.000Z',
    });
    expect(dto.channels[0]).toEqual({
      channel: 'PUSH',
      state: 'SENT',
      recipients: 10,
      delivered: 10,
      attempts: 1,
      lastError: undefined,
      sentAt: NOW.toISOString(),
    });
  });

  it('leaves out what a draft does not have', () => {
    const dto = toHazardWarningDto(warningEntity({ validUntil: undefined }), NOW);
    expect(dto.active).toBe(false);
    expect(dto.issuedAt).toBeUndefined();
    expect(dto.validUntil).toBeUndefined();
    expect(dto.cancellation).toBeUndefined();
  });

  it('includes the cancellation', () => {
    const dto = toHazardWarningDto(
      issuedWarning({
        status: 'CANCELLED',
        cancellation: { cancelledAt: NOW, cancelledBy: 'Officer Silva', reason: 'Receded' },
      }),
      NOW,
    );
    expect(dto.cancellation).toEqual({
      cancelledAt: NOW.toISOString(),
      cancelledBy: 'Officer Silva',
      reason: 'Receded',
    });
  });
});

describe('toHazardWarningDetailDto', () => {
  it('adds the logs and the acknowledged count', () => {
    const dto = toHazardWarningDetailDto(
      issuedWarning(),
      [
        {
          id: 'l1',
          warningId: issuedWarning().id,
          channel: 'SMS',
          kind: 'WARNING',
          outcome: 'FAILED',
          message: 'SMS gateway is unavailable',
          recipients: 3,
          createdAt: NOW,
        },
      ],
      4,
      NOW,
    );
    expect(dto.acknowledged).toBe(4);
    expect(dto.logs).toEqual([
      expect.objectContaining({ id: 'l1', outcome: 'FAILED', createdAt: NOW.toISOString() }),
    ]);
  });
});

describe('toCitizenAlertDto', () => {
  it('shows the citizen only public fields, with the acknowledgement', () => {
    const dto = toCitizenAlertDto(
      issuedWarning(),
      delivery({ acknowledgedAt: NOW }),
      'ACTIVE',
    );

    expect(dto).toEqual({
      id: issuedWarning().id,
      reference: 'HW-2026-0001',
      hazardType: 'FLOOD',
      level: 'HIGH',
      districts: ['COLOMBO', 'GAMPAHA'],
      description: 'Heavy rainfall expected. Evacuate low-lying areas.',
      safetyInstructions: ['Move to higher ground immediately'],
      issuedAt: NOW.toISOString(),
      validUntil: '2026-10-07T20:00:00.000Z',
      state: 'ACTIVE',
      cancelReason: undefined,
      acknowledgedAt: NOW.toISOString(),
    });
    expect(dto).not.toHaveProperty('issuedBy');
  });
});
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings/domain/hazard-warning.mapper.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 6: Implement `apps/api/src/hazard-warnings/domain/hazard-warning.mapper.ts`**

```ts
import type {
  CitizenAlertDto,
  CitizenAlertState,
  DisseminationStatusDto,
  HazardWarningDetailDto,
  HazardWarningDto,
  NotificationLogDto,
} from '@repo/types';

import type { AlertDeliveryEntity } from '../../citizens/citizen.entity.js';
import type {
  DisseminationChannelState,
  HazardWarningEntity,
  NotificationLogEntity,
} from './hazard-warning.entity.js';
import { isActive } from './warning-rules.js';

function iso(date: Date | undefined): string | undefined {
  return date?.toISOString();
}

function toChannelDto(item: DisseminationChannelState): DisseminationStatusDto {
  return {
    channel: item.channel,
    state: item.state,
    recipients: item.recipients,
    delivered: item.delivered,
    attempts: item.attempts,
    lastError: item.lastError,
    sentAt: iso(item.sentAt),
  };
}

/** The officer's view. `now` decides whether the warning is still active. */
export function toHazardWarningDto(
  warning: HazardWarningEntity,
  now: Date,
): HazardWarningDto {
  const { cancellation } = warning;
  return {
    id: warning.id,
    reference: warning.reference,
    hazardType: warning.hazardType,
    level: warning.level,
    description: warning.description,
    additionalInfo: warning.additionalInfo,
    safetyInstructions: warning.safetyInstructions,
    districts: warning.districts,
    validFrom: iso(warning.validFrom),
    validUntil: iso(warning.validUntil),
    sourceReportId: warning.sourceReportId,
    status: warning.status,
    active: isActive(warning, now),
    channels: warning.channels.map(toChannelDto),
    createdBy: warning.createdBy,
    issuedBy: warning.issuedBy,
    issuedAt: iso(warning.issuedAt),
    cancellation: cancellation && {
      cancelledAt: cancellation.cancelledAt.toISOString(),
      cancelledBy: cancellation.cancelledBy,
      reason: cancellation.reason,
    },
    createdAt: warning.createdAt.toISOString(),
    updatedAt: warning.updatedAt.toISOString(),
  };
}

export function toNotificationLogDto(log: NotificationLogEntity): NotificationLogDto {
  return {
    id: log.id,
    channel: log.channel,
    kind: log.kind,
    outcome: log.outcome,
    message: log.message,
    recipients: log.recipients,
    createdAt: log.createdAt.toISOString(),
  };
}

export function toHazardWarningDetailDto(
  warning: HazardWarningEntity,
  logs: NotificationLogEntity[],
  acknowledged: number,
  now: Date,
): HazardWarningDetailDto {
  return {
    ...toHazardWarningDto(warning, now),
    logs: logs.map(toNotificationLogDto),
    acknowledged,
  };
}

/**
 * The citizen's view. Only issued warnings reach here, so issuedAt and
 * validUntil are always set; officer names and internal notes are left out.
 */
export function toCitizenAlertDto(
  warning: HazardWarningEntity,
  delivery: AlertDeliveryEntity,
  state: CitizenAlertState,
): CitizenAlertDto {
  return {
    id: warning.id,
    reference: warning.reference,
    hazardType: warning.hazardType,
    level: warning.level,
    districts: warning.districts,
    description: warning.description ?? '',
    safetyInstructions: warning.safetyInstructions,
    issuedAt: (warning.issuedAt ?? warning.createdAt).toISOString(),
    validUntil: (warning.validUntil ?? warning.createdAt).toISOString(),
    state,
    cancelReason: warning.cancellation?.reason,
    acknowledgedAt: delivery.acknowledgedAt?.toISOString() ?? null,
  };
}
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings/domain && bun run check-types && bun run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/hazard-warnings apps/api/src/citizens
git commit -m "feat(api): add hazard warning domain rules and mappers"
```

---
### Task 4: Repositories (`citizens/` and `hazard-warnings/` storage)

**Files:**
- Create: `apps/api/src/citizens/citizen-directory.ts`, `apps/api/src/citizens/alert-delivery.repository.ts`, `apps/api/src/citizens/infrastructure/prisma-citizen-directory.ts`, `apps/api/src/citizens/infrastructure/prisma-alert-delivery.repository.ts`, `apps/api/src/citizens/infrastructure/prisma-citizens.spec.ts`
- Create: `apps/api/src/hazard-warnings/hazard-warning.repository.ts`, `apps/api/src/hazard-warnings/notification-log.repository.ts`, `apps/api/src/hazard-warnings/infrastructure/prisma-hazard-warning.repository.ts`, `apps/api/src/hazard-warnings/infrastructure/prisma-notification-log.repository.ts`, `apps/api/src/hazard-warnings/infrastructure/prisma-hazard-warning.repository.spec.ts`, `apps/api/src/hazard-warnings/infrastructure/prisma-warnings.integration.spec.ts`
- Modify: `apps/api/src/hazard-warnings/testing/fixtures.ts` (fake repositories)

**Interfaces:**
- Consumes: Task 2 Prisma models and `isUniqueViolation`, `nextReference`; Task 3 entities and `ISSUED_STATUSES`.
- Produces (exact names used by Tasks 5-8):

```ts
// citizens/citizen-directory.ts
export const CITIZEN_DIRECTORY = Symbol('CITIZEN_DIRECTORY');
export interface Recipient { deviceId: string; district: District; phone?: string }
export interface RecipientCount { total: number; withPhone: number; byDistrict: Partial<Record<District, number>> }
export interface CitizenDirectory {
  register(deviceId: string, district: District, phone?: string): Promise<CitizenEntity>;
  findByDeviceId(deviceId: string): Promise<CitizenEntity | null>;
  findInDistricts(districts: District[]): Promise<Recipient[]>;
  countInDistricts(districts: District[]): Promise<RecipientCount>;
}

// citizens/alert-delivery.repository.ts
export const ALERT_DELIVERY_REPOSITORY = Symbol('ALERT_DELIVERY_REPOSITORY');
export interface AlertDeliveryRepository {
  /** Idempotent. Returns how many distinct devices now hold the warning. */
  recordDelivered(warningId: string, deviceIds: string[]): Promise<number>;
  listForDevice(deviceId: string, limit: number): Promise<AlertDeliveryEntity[]>;
  /** Sets acknowledgedAt once; null when nothing was delivered to this device. */
  acknowledge(warningId: string, deviceId: string, at: Date): Promise<AlertDeliveryEntity | null>;
  countAcknowledged(warningId: string): Promise<number>;
}

// hazard-warnings/hazard-warning.repository.ts
export const HAZARD_WARNING_REPOSITORY = Symbol('HAZARD_WARNING_REPOSITORY');
export interface NewWarning extends WarningContent { clientRequestId: string; createdBy: string; status: 'DRAFT' | 'DISSEMINATING'; channels: DisseminationChannelState[]; issuedBy?: string; issuedAt?: Date }
export interface CreateWarningResult { warning: HazardWarningEntity; created: boolean }
export interface DisseminationStart { issuedBy?: string; issuedAt?: Date; validFrom?: Date; channels?: DisseminationChannelState[] }
export interface CancelInput { cancelledBy: string; reason: string; cancelledAt: Date }
export type TransitionResult = { outcome: 'UPDATED'; warning: HazardWarningEntity } | { outcome: 'WRONG_STATE'; warning: HazardWarningEntity } | { outcome: 'NOT_FOUND' };
export interface OverlapQuery { hazardType: HazardType; districts: District[]; now: Date; excludeId?: string }
export interface WarningListQuery { view: WarningView; page: number; limit: number; now: Date }
export interface HazardWarningRepository {
  create(input: NewWarning): Promise<CreateWarningResult>;
  findById(id: string): Promise<HazardWarningEntity | null>;
  findByIds(ids: string[]): Promise<HazardWarningEntity[]>;
  findByClientRequestId(clientRequestId: string): Promise<HazardWarningEntity | null>;
  updateDraft(id: string, content: WarningContent): Promise<TransitionResult>;
  deleteDraft(id: string): Promise<'DELETED' | 'NOT_DRAFT' | 'NOT_FOUND'>;
  startDissemination(id: string, from: readonly WarningStatus[], changes: DisseminationStart): Promise<TransitionResult>;
  recordDissemination(id: string, channels: DisseminationChannelState[], status: WarningStatus): Promise<HazardWarningEntity>;
  cancel(id: string, input: CancelInput): Promise<TransitionResult>;
  findActiveOverlapping(query: OverlapQuery): Promise<HazardWarningEntity[]>;
  list(query: WarningListQuery): Promise<Paginated<HazardWarningEntity>>;
  stats(now: Date, todayStart: Date): Promise<WarningStats>;
}

// hazard-warnings/notification-log.repository.ts
export const NOTIFICATION_LOG_REPOSITORY = Symbol('NOTIFICATION_LOG_REPOSITORY');
export type NewNotificationLog = Omit<NotificationLogEntity, 'id' | 'createdAt'>;
export interface NotificationLogRepository {
  record(entry: NewNotificationLog): Promise<void>;
  listForWarning(warningId: string, limit: number): Promise<NotificationLogEntity[]>;
}
```

- Fixtures added: `fakeWarningRepository()`, `fakeLogRepository()`, `fakeDirectory()`, `fakeDeliveries()` returning objects of `vi.fn<Interface['method']>()`.

- [ ] **Step 1: Create the four interface files** exactly as in the Interfaces block above, each with its imports (`import type { ... } from '@repo/types'`, entity imports with `.js` suffix) and a one-line doc comment on the interface ("Everything the services need from storage, with no database types leaking out.").

- [ ] **Step 2: Add the fakes to `apps/api/src/hazard-warnings/testing/fixtures.ts`**

```ts
import type { AlertDeliveryRepository } from '../../citizens/alert-delivery.repository.js';
import type { CitizenDirectory } from '../../citizens/citizen-directory.js';
import type { HazardWarningRepository } from '../hazard-warning.repository.js';
import type { NotificationLogRepository } from '../notification-log.repository.js';

export function fakeWarningRepository() {
  return {
    create: vi.fn<HazardWarningRepository['create']>(),
    findById: vi.fn<HazardWarningRepository['findById']>(),
    findByIds: vi.fn<HazardWarningRepository['findByIds']>(),
    findByClientRequestId: vi.fn<HazardWarningRepository['findByClientRequestId']>(),
    updateDraft: vi.fn<HazardWarningRepository['updateDraft']>(),
    deleteDraft: vi.fn<HazardWarningRepository['deleteDraft']>(),
    startDissemination: vi.fn<HazardWarningRepository['startDissemination']>(),
    recordDissemination: vi.fn<HazardWarningRepository['recordDissemination']>(),
    cancel: vi.fn<HazardWarningRepository['cancel']>(),
    findActiveOverlapping: vi.fn<HazardWarningRepository['findActiveOverlapping']>(),
    list: vi.fn<HazardWarningRepository['list']>(),
    stats: vi.fn<HazardWarningRepository['stats']>(),
  };
}

export function fakeLogRepository() {
  return {
    record: vi.fn<NotificationLogRepository['record']>().mockResolvedValue(undefined),
    listForWarning: vi.fn<NotificationLogRepository['listForWarning']>().mockResolvedValue([]),
  };
}

export function fakeDirectory() {
  return {
    register: vi.fn<CitizenDirectory['register']>(),
    findByDeviceId: vi.fn<CitizenDirectory['findByDeviceId']>(),
    findInDistricts: vi.fn<CitizenDirectory['findInDistricts']>().mockResolvedValue([]),
    countInDistricts: vi.fn<CitizenDirectory['countInDistricts']>(),
  };
}

export function fakeDeliveries() {
  return {
    recordDelivered: vi
      .fn<AlertDeliveryRepository['recordDelivered']>()
      .mockImplementation(async (_id, deviceIds) => new Set(deviceIds).size),
    listForDevice: vi.fn<AlertDeliveryRepository['listForDevice']>().mockResolvedValue([]),
    acknowledge: vi.fn<AlertDeliveryRepository['acknowledge']>(),
    countAcknowledged: vi.fn<AlertDeliveryRepository['countAcknowledged']>().mockResolvedValue(0),
  };
}
```

- [ ] **Step 3: Write failing unit tests for the warning repository** — `apps/api/src/hazard-warnings/infrastructure/prisma-hazard-warning.repository.spec.ts`

```ts
import { Prisma } from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service.js';
import {
  channel,
  hoursFromNow,
  NOW,
  OTHER_WARNING_ID,
  WARNING_ID,
  warningEntity,
} from '../testing/fixtures.js';
import { PrismaHazardWarningRepository } from './prisma-hazard-warning.repository.js';

/** A stored row as Prisma returns it: nulls, not undefined. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: WARNING_ID,
    reference: 'HW-2026-0001',
    clientRequestId: '7b0e6c0e-0f5e-4a52-9a77-3d3a0c1f9a11',
    hazardType: 'FLOOD',
    level: 'HIGH',
    description: 'Heavy rainfall expected. Evacuate low-lying areas.',
    additionalInfo: null,
    safetyInstructions: ['Move to higher ground immediately'],
    districts: ['COLOMBO', 'GAMPAHA'],
    validFrom: NOW,
    validUntil: hoursFromNow(12),
    sourceReportId: null,
    status: 'DRAFT',
    channels: [],
    createdBy: 'Officer Silva',
    issuedBy: null,
    issuedAt: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function fakePrisma() {
  return {
    counter: { upsert: vi.fn().mockResolvedValue({ id: 'HW-2026', seq: 1 }) },
    hazardWarning: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

describe('PrismaHazardWarningRepository', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let repository: PrismaHazardWarningRepository;

  beforeEach(() => {
    prisma = fakePrisma();
    repository = new PrismaHazardWarningRepository(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    const input = {
      ...warningEntity(),
      createdBy: 'Officer Silva',
      status: 'DRAFT' as const,
      channels: [],
    };

    it('stores the warning with a fresh HW reference', async () => {
      prisma.hazardWarning.create.mockResolvedValue(row());

      const result = await repository.create(input);

      expect(result.created).toBe(true);
      expect(result.warning.additionalInfo).toBeUndefined();
      expect(prisma.hazardWarning.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ reference: expect.stringMatching(/^HW-\d{4}-0001$/), status: 'DRAFT' }),
      });
    });

    it('returns the stored warning when the clientRequestId was already used', async () => {
      prisma.hazardWarning.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup clientRequestId', {
          code: 'P2002',
          clientVersion: '6.19.3',
          meta: { target: 'clientRequestId' },
        }),
      );
      prisma.hazardWarning.findUnique.mockResolvedValue(row());

      const result = await repository.create(input);

      expect(result).toEqual({ warning: expect.objectContaining({ id: WARNING_ID }), created: false });
    });
  });

  it('treats a malformed id as not found without querying', async () => {
    await expect(repository.findById('not-an-id')).resolves.toBeNull();
    await expect(repository.cancel('nope', { cancelledBy: 'x', reason: 'y', cancelledAt: NOW })).resolves.toEqual({
      outcome: 'NOT_FOUND',
    });
    expect(prisma.hazardWarning.findUnique).not.toHaveBeenCalled();
  });

  it('maps the cancellation and channels of a stored row', async () => {
    prisma.hazardWarning.findUnique.mockResolvedValue(
      row({
        status: 'CANCELLED',
        cancelledAt: NOW,
        cancelledBy: 'Officer Silva',
        cancelReason: 'Water receded',
        channels: [{ ...channel('SMS'), lastError: null, sentAt: null }],
      }),
    );

    const warning = await repository.findById(WARNING_ID);

    expect(warning?.cancellation).toEqual({ cancelledAt: NOW, cancelledBy: 'Officer Silva', reason: 'Water receded' });
    expect(warning?.channels[0]).toEqual({ ...channel('SMS'), lastError: undefined, sentAt: undefined });
  });

  describe('conditional transitions', () => {
    it('updates a draft only while it is a draft, clearing removed fields', async () => {
      prisma.hazardWarning.updateMany.mockResolvedValue({ count: 1 });
      prisma.hazardWarning.findUnique.mockResolvedValue(row());

      const result = await repository.updateDraft(WARNING_ID, { ...warningEntity(), description: undefined });

      expect(result.outcome).toBe('UPDATED');
      expect(prisma.hazardWarning.updateMany).toHaveBeenCalledWith({
        where: { id: WARNING_ID, status: { in: ['DRAFT'] } },
        data: expect.objectContaining({ description: null }),
      });
    });

    it('reports WRONG_STATE with the current warning when no row matched', async () => {
      prisma.hazardWarning.updateMany.mockResolvedValue({ count: 0 });
      prisma.hazardWarning.findUnique.mockResolvedValue(row({ status: 'CANCELLED' }));

      const result = await repository.cancel(WARNING_ID, { cancelledBy: 'Officer Silva', reason: 'Done', cancelledAt: NOW });

      expect(result).toEqual({ outcome: 'WRONG_STATE', warning: expect.objectContaining({ status: 'CANCELLED' }) });
      expect(prisma.hazardWarning.updateMany).toHaveBeenCalledWith({
        where: { id: WARNING_ID, status: { in: ['DISSEMINATING', 'DISSEMINATED', 'PARTIALLY_DISSEMINATED', 'PENDING_DISSEMINATION'] } },
        data: { status: 'CANCELLED', cancelledAt: NOW, cancelledBy: 'Officer Silva', cancelReason: 'Done' },
      });
    });

    it('reports NOT_FOUND when the row is gone', async () => {
      prisma.hazardWarning.updateMany.mockResolvedValue({ count: 0 });
      prisma.hazardWarning.findUnique.mockResolvedValue(null);

      await expect(repository.startDissemination(WARNING_ID, ['DRAFT'], {})).resolves.toEqual({ outcome: 'NOT_FOUND' });
    });

    it('starts dissemination with the issue details and fresh channels', async () => {
      prisma.hazardWarning.updateMany.mockResolvedValue({ count: 1 });
      prisma.hazardWarning.findUnique.mockResolvedValue(row({ status: 'DISSEMINATING' }));

      await repository.startDissemination(WARNING_ID, ['DRAFT'], {
        issuedBy: 'Officer Silva',
        issuedAt: NOW,
        validFrom: NOW,
        channels: [channel('PUSH', { state: 'PENDING' })],
      });

      expect(prisma.hazardWarning.updateMany).toHaveBeenCalledWith({
        where: { id: WARNING_ID, status: { in: ['DRAFT'] } },
        data: {
          status: 'DISSEMINATING',
          issuedBy: 'Officer Silva',
          issuedAt: NOW,
          validFrom: NOW,
          channels: { set: [expect.objectContaining({ channel: 'PUSH', state: 'PENDING' })] },
        },
      });
    });

    it('records dissemination only while still disseminating, and returns the row', async () => {
      prisma.hazardWarning.updateMany.mockResolvedValue({ count: 1 });
      prisma.hazardWarning.findUnique.mockResolvedValue(row({ status: 'DISSEMINATED' }));

      const warning = await repository.recordDissemination(WARNING_ID, [channel('PUSH')], 'DISSEMINATED');

      expect(warning.status).toBe('DISSEMINATED');
      expect(prisma.hazardWarning.updateMany).toHaveBeenCalledWith({
        where: { id: WARNING_ID, status: 'DISSEMINATING' },
        data: { status: 'DISSEMINATED', channels: { set: [expect.objectContaining({ channel: 'PUSH' })] } },
      });
    });
  });

  it('deletes only drafts', async () => {
    prisma.hazardWarning.deleteMany.mockResolvedValueOnce({ count: 1 });
    await expect(repository.deleteDraft(WARNING_ID)).resolves.toBe('DELETED');

    prisma.hazardWarning.deleteMany.mockResolvedValueOnce({ count: 0 });
    prisma.hazardWarning.findUnique.mockResolvedValueOnce(row({ status: 'DISSEMINATED' }));
    await expect(repository.deleteDraft(WARNING_ID)).resolves.toBe('NOT_DRAFT');

    prisma.hazardWarning.deleteMany.mockResolvedValueOnce({ count: 0 });
    prisma.hazardWarning.findUnique.mockResolvedValueOnce(null);
    await expect(repository.deleteDraft(WARNING_ID)).resolves.toBe('NOT_FOUND');
  });

  it('finds active warnings for the same hazard in any shared district', async () => {
    prisma.hazardWarning.findMany.mockResolvedValue([row({ id: OTHER_WARNING_ID, status: 'DISSEMINATED' })]);

    const found = await repository.findActiveOverlapping({
      hazardType: 'FLOOD',
      districts: ['COLOMBO'],
      now: NOW,
      excludeId: WARNING_ID,
    });

    expect(found).toHaveLength(1);
    expect(prisma.hazardWarning.findMany).toHaveBeenCalledWith({
      where: {
        hazardType: 'FLOOD',
        districts: { hasSome: ['COLOMBO'] },
        status: { in: ['DISSEMINATING', 'DISSEMINATED', 'PARTIALLY_DISSEMINATED', 'PENDING_DISSEMINATION'] },
        validUntil: { gt: NOW },
        id: { not: WARNING_ID },
      },
      orderBy: { issuedAt: 'desc' },
    });
  });

  it.each([
    ['active', { status: { in: expect.any(Array) }, validUntil: { gt: NOW } }],
    ['drafts', { status: 'DRAFT' }],
    ['past', { OR: [{ status: 'CANCELLED' }, { status: { in: expect.any(Array) }, validUntil: { lte: NOW } }] }],
  ] as const)('lists the %s view with paging', async (view, where) => {
    prisma.hazardWarning.findMany.mockResolvedValue([row()]);
    prisma.hazardWarning.count.mockResolvedValue(21);

    const page = await repository.list({ view, page: 2, limit: 20, now: NOW });

    expect(page).toEqual({ items: [expect.any(Object)], total: 21, page: 2, limit: 20 });
    expect(prisma.hazardWarning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 20, take: 20 }),
    );
  });

  it('counts active, drafts and issued today', async () => {
    prisma.hazardWarning.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(3);

    await expect(repository.stats(NOW, hoursFromNow(-8))).resolves.toEqual({ active: 2, drafts: 1, issuedToday: 3 });
  });

  it('finds several warnings by id, ignoring malformed ids', async () => {
    prisma.hazardWarning.findMany.mockResolvedValue([row()]);

    await repository.findByIds([WARNING_ID, 'bad']);

    expect(prisma.hazardWarning.findMany).toHaveBeenCalledWith({ where: { id: { in: [WARNING_ID] } } });
  });
});
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings/infrastructure`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `apps/api/src/hazard-warnings/infrastructure/prisma-hazard-warning.repository.ts`**

```ts
import { Injectable } from '@nestjs/common';
import type { HazardWarning as HazardWarningRow, Prisma } from '@prisma/client';

import {
  ISSUED_STATUSES,
  type District,
  type Paginated,
  type WarningStats,
  type WarningStatus,
  type WarningView,
} from '@repo/types';

import { PrismaService } from '../../prisma/prisma.service.js';
import { isUniqueViolation, nextReference } from '../../prisma/references.js';
import type {
  DisseminationChannelState,
  HazardWarningEntity,
  WarningContent,
} from '../domain/hazard-warning.entity.js';
import type {
  CancelInput,
  CreateWarningResult,
  DisseminationStart,
  HazardWarningRepository,
  NewWarning,
  OverlapQuery,
  TransitionResult,
  WarningListQuery,
} from '../hazard-warning.repository.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const ISSUED = [...ISSUED_STATUSES];

function toChannel(item: HazardWarningRow['channels'][number]): DisseminationChannelState {
  return {
    channel: item.channel,
    state: item.state,
    recipients: item.recipients,
    delivered: item.delivered,
    attempts: item.attempts,
    lastError: item.lastError ?? undefined,
    sentAt: item.sentAt ?? undefined,
  };
}

function toEntity(row: HazardWarningRow): HazardWarningEntity {
  return {
    id: row.id,
    reference: row.reference,
    clientRequestId: row.clientRequestId,
    hazardType: row.hazardType,
    level: row.level,
    description: row.description ?? undefined,
    additionalInfo: row.additionalInfo ?? undefined,
    safetyInstructions: row.safetyInstructions,
    // Stored as strings; the DTO only ever lets District codes in.
    districts: row.districts as District[],
    validFrom: row.validFrom ?? undefined,
    validUntil: row.validUntil ?? undefined,
    sourceReportId: row.sourceReportId ?? undefined,
    status: row.status,
    channels: row.channels.map(toChannel),
    createdBy: row.createdBy,
    issuedBy: row.issuedBy ?? undefined,
    issuedAt: row.issuedAt ?? undefined,
    cancellation:
      row.cancelledAt && row.cancelledBy && row.cancelReason
        ? { cancelledAt: row.cancelledAt, cancelledBy: row.cancelledBy, reason: row.cancelReason }
        : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Optional fields become null so an edit can clear them. */
function contentData(content: WarningContent) {
  return {
    hazardType: content.hazardType,
    level: content.level,
    description: content.description ?? null,
    additionalInfo: content.additionalInfo ?? null,
    safetyInstructions: content.safetyInstructions,
    districts: content.districts,
    validFrom: content.validFrom ?? null,
    validUntil: content.validUntil ?? null,
    sourceReportId: content.sourceReportId ?? null,
  };
}

function channelData(channels: DisseminationChannelState[]) {
  return channels.map((item) => ({
    channel: item.channel,
    state: item.state,
    recipients: item.recipients,
    delivered: item.delivered,
    attempts: item.attempts,
    lastError: item.lastError ?? null,
    sentAt: item.sentAt ?? null,
  }));
}

function viewQuery(view: WarningView, now: Date) {
  const issued = { status: { in: ISSUED } };
  const byNewest = (field: 'issuedAt' | 'updatedAt') => [{ [field]: 'desc' as const }, { id: 'asc' as const }];

  if (view === 'drafts') {
    return { where: { status: 'DRAFT' as const }, orderBy: byNewest('updatedAt') };
  }
  if (view === 'past') {
    return {
      where: { OR: [{ status: 'CANCELLED' as const }, { ...issued, validUntil: { lte: now } }] },
      orderBy: byNewest('updatedAt'),
    };
  }
  return { where: { ...issued, validUntil: { gt: now } }, orderBy: byNewest('issuedAt') };
}

@Injectable()
export class PrismaHazardWarningRepository implements HazardWarningRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: NewWarning): Promise<CreateWarningResult> {
    const reference = await nextReference(this.prisma, 'HW');
    try {
      const row = await this.prisma.hazardWarning.create({
        data: {
          ...contentData(input),
          reference,
          clientRequestId: input.clientRequestId,
          status: input.status,
          channels: channelData(input.channels),
          createdBy: input.createdBy,
          issuedBy: input.issuedBy ?? null,
          issuedAt: input.issuedAt ?? null,
        },
      });
      return { warning: toEntity(row), created: true };
    } catch (error) {
      if (isUniqueViolation(error, 'clientRequestId')) {
        const existing = await this.findByClientRequestId(input.clientRequestId);
        if (existing) return { warning: existing, created: false };
      }
      throw error;
    }
  }

  async findById(id: string): Promise<HazardWarningEntity | null> {
    if (!OBJECT_ID.test(id)) return null;
    const row = await this.prisma.hazardWarning.findUnique({ where: { id } });
    return row && toEntity(row);
  }

  async findByIds(ids: string[]): Promise<HazardWarningEntity[]> {
    const valid = ids.filter((id) => OBJECT_ID.test(id));
    if (valid.length === 0) return [];
    const rows = await this.prisma.hazardWarning.findMany({ where: { id: { in: valid } } });
    return rows.map(toEntity);
  }

  async findByClientRequestId(clientRequestId: string): Promise<HazardWarningEntity | null> {
    const row = await this.prisma.hazardWarning.findUnique({ where: { clientRequestId } });
    return row && toEntity(row);
  }

  updateDraft(id: string, content: WarningContent): Promise<TransitionResult> {
    return this.transition(id, ['DRAFT'], contentData(content));
  }

  async deleteDraft(id: string): Promise<'DELETED' | 'NOT_DRAFT' | 'NOT_FOUND'> {
    if (!OBJECT_ID.test(id)) return 'NOT_FOUND';
    const { count } = await this.prisma.hazardWarning.deleteMany({ where: { id, status: 'DRAFT' } });
    if (count > 0) return 'DELETED';
    const row = await this.prisma.hazardWarning.findUnique({ where: { id } });
    return row ? 'NOT_DRAFT' : 'NOT_FOUND';
  }

  startDissemination(
    id: string,
    from: readonly WarningStatus[],
    changes: DisseminationStart,
  ): Promise<TransitionResult> {
    return this.transition(id, from, {
      status: 'DISSEMINATING',
      ...(changes.issuedBy !== undefined && { issuedBy: changes.issuedBy }),
      ...(changes.issuedAt !== undefined && { issuedAt: changes.issuedAt }),
      ...(changes.validFrom !== undefined && { validFrom: changes.validFrom }),
      ...(changes.channels !== undefined && { channels: { set: channelData(changes.channels) } }),
    });
  }

  async recordDissemination(
    id: string,
    channels: DisseminationChannelState[],
    status: WarningStatus,
  ): Promise<HazardWarningEntity> {
    // Guarded so a cancel that landed mid-send is never overwritten.
    await this.prisma.hazardWarning.updateMany({
      where: { id, status: 'DISSEMINATING' },
      data: { status, channels: { set: channelData(channels) } },
    });
    const row = await this.prisma.hazardWarning.findUnique({ where: { id } });
    if (!row) throw new Error(`Warning ${id} disappeared while it was being sent`);
    return toEntity(row);
  }

  cancel(id: string, input: CancelInput): Promise<TransitionResult> {
    return this.transition(id, ISSUED, {
      status: 'CANCELLED',
      cancelledAt: input.cancelledAt,
      cancelledBy: input.cancelledBy,
      cancelReason: input.reason,
    });
  }

  async findActiveOverlapping(query: OverlapQuery): Promise<HazardWarningEntity[]> {
    const rows = await this.prisma.hazardWarning.findMany({
      where: {
        hazardType: query.hazardType,
        districts: { hasSome: query.districts },
        status: { in: ISSUED },
        validUntil: { gt: query.now },
        ...(query.excludeId && { id: { not: query.excludeId } }),
      },
      orderBy: { issuedAt: 'desc' },
    });
    return rows.map(toEntity);
  }

  async list(query: WarningListQuery): Promise<Paginated<HazardWarningEntity>> {
    const { where, orderBy } = viewQuery(query.view, query.now);
    const [rows, total] = await Promise.all([
      this.prisma.hazardWarning.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.hazardWarning.count({ where }),
    ]);
    return { items: rows.map(toEntity), total, page: query.page, limit: query.limit };
  }

  async stats(now: Date, todayStart: Date): Promise<WarningStats> {
    const [active, drafts, issuedToday] = await Promise.all([
      this.prisma.hazardWarning.count({ where: { status: { in: ISSUED }, validUntil: { gt: now } } }),
      this.prisma.hazardWarning.count({ where: { status: 'DRAFT' } }),
      this.prisma.hazardWarning.count({ where: { issuedAt: { gte: todayStart } } }),
    ]);
    return { active, drafts, issuedToday };
  }

  /**
   * The status filter is the guard: of two concurrent changes to the same
   * warning only one update can match, so each transition happens once.
   */
  private async transition(
    id: string,
    from: readonly WarningStatus[],
    data: Prisma.HazardWarningUpdateManyMutationInput,
  ): Promise<TransitionResult> {
    if (!OBJECT_ID.test(id)) return { outcome: 'NOT_FOUND' };

    const { count } = await this.prisma.hazardWarning.updateMany({
      where: { id, status: { in: [...from] } },
      data,
    });
    const row = await this.prisma.hazardWarning.findUnique({ where: { id } });
    if (!row) return { outcome: 'NOT_FOUND' };
    return { outcome: count === 0 ? 'WRONG_STATE' : 'UPDATED', warning: toEntity(row) };
  }
}
```

If `tsc` reports that `channels: { set }` is not assignable to `HazardWarningUpdateManyMutationInput` (composite lists are not in the "many" input on some Prisma versions), change `transition` and `recordDissemination` to `updateMany` for the status guard plus a follow-up `this.prisma.hazardWarning.update({ where: { id }, data: { channels: { set } } })` only when `count > 0`, and adjust the two affected assertions in the spec to expect that second call. Prefer the single `updateMany` if it type-checks.

Run: `cd apps/api && bunx vitest run src/hazard-warnings/infrastructure/prisma-hazard-warning.repository.spec.ts && bun run check-types`
Expected: PASS.

- [ ] **Step 5: Implement the log repository** — `apps/api/src/hazard-warnings/infrastructure/prisma-notification-log.repository.ts`

```ts
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { NotificationLogEntity } from '../domain/hazard-warning.entity.js';
import type {
  NewNotificationLog,
  NotificationLogRepository,
} from '../notification-log.repository.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

@Injectable()
export class PrismaNotificationLogRepository implements NotificationLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: NewNotificationLog): Promise<void> {
    await this.prisma.notificationLog.create({ data: entry });
  }

  async listForWarning(warningId: string, limit: number): Promise<NotificationLogEntity[]> {
    if (!OBJECT_ID.test(warningId)) return [];
    return this.prisma.notificationLog.findMany({
      where: { warningId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }
}
```

- [ ] **Step 6: Write failing tests for the citizen storage** — `apps/api/src/citizens/infrastructure/prisma-citizens.spec.ts`

```ts
import { Prisma } from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { DEVICE_ID, NOW, OTHER_DEVICE_ID, WARNING_ID } from '../../hazard-warnings/testing/fixtures.js';
import { PrismaAlertDeliveryRepository } from './prisma-alert-delivery.repository.js';
import { PrismaCitizenDirectory } from './prisma-citizen-directory.js';

function citizenRow(overrides: Record<string, unknown> = {}) {
  return { id: 'c1', deviceId: DEVICE_ID, district: 'COLOMBO', phone: null, createdAt: NOW, updatedAt: NOW, ...overrides };
}

function fakePrisma() {
  return {
    citizen: { upsert: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
    alertDelivery: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  };
}

describe('PrismaCitizenDirectory', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let directory: PrismaCitizenDirectory;

  beforeEach(() => {
    prisma = fakePrisma();
    directory = new PrismaCitizenDirectory(prisma as unknown as PrismaService);
  });

  it('registers or moves a citizen, storing a missing phone as null', async () => {
    prisma.citizen.upsert.mockResolvedValue(citizenRow());

    const citizen = await directory.register(DEVICE_ID, 'COLOMBO');

    expect(citizen).toEqual({ id: 'c1', deviceId: DEVICE_ID, district: 'COLOMBO', phone: undefined, updatedAt: NOW });
    expect(prisma.citizen.upsert).toHaveBeenCalledWith({
      where: { deviceId: DEVICE_ID },
      create: { deviceId: DEVICE_ID, district: 'COLOMBO', phone: null },
      update: { district: 'COLOMBO', phone: null },
    });
  });

  it('falls back to an update when two first registrations race', async () => {
    prisma.citizen.upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup deviceId', { code: 'P2002', clientVersion: '6.19.3', meta: { target: 'deviceId' } }),
    );
    prisma.citizen.update.mockResolvedValue(citizenRow({ district: 'KANDY' }));

    await expect(directory.register(DEVICE_ID, 'KANDY')).resolves.toMatchObject({ district: 'KANDY' });
  });

  it('finds recipients in the districts', async () => {
    prisma.citizen.findMany.mockResolvedValue([citizenRow({ phone: '+94771234567' })]);

    await expect(directory.findInDistricts(['COLOMBO'])).resolves.toEqual([
      { deviceId: DEVICE_ID, district: 'COLOMBO', phone: '+94771234567' },
    ]);
    expect(prisma.citizen.findMany).toHaveBeenCalledWith({ where: { district: { in: ['COLOMBO'] } } });
  });

  it('counts recipients per district and those reachable by SMS', async () => {
    prisma.citizen.groupBy.mockResolvedValue([
      { district: 'COLOMBO', _count: { _all: 3 } },
      { district: 'GAMPAHA', _count: { _all: 2 } },
    ]);
    prisma.citizen.count.mockResolvedValue(4);

    await expect(directory.countInDistricts(['COLOMBO', 'GAMPAHA', 'KANDY'])).resolves.toEqual({
      total: 5,
      withPhone: 4,
      byDistrict: { COLOMBO: 3, GAMPAHA: 2, KANDY: 0 },
    });
    expect(prisma.citizen.count).toHaveBeenCalledWith({
      where: { district: { in: ['COLOMBO', 'GAMPAHA', 'KANDY'] }, phone: { not: null } },
    });
  });
});

describe('PrismaAlertDeliveryRepository', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let deliveries: PrismaAlertDeliveryRepository;

  beforeEach(() => {
    prisma = fakePrisma();
    deliveries = new PrismaAlertDeliveryRepository(prisma as unknown as PrismaService);
  });

  it('creates rows only for devices that do not have the warning yet', async () => {
    prisma.alertDelivery.findMany.mockResolvedValue([{ deviceId: DEVICE_ID }]);
    prisma.alertDelivery.createMany.mockResolvedValue({ count: 1 });

    const count = await deliveries.recordDelivered(WARNING_ID, [DEVICE_ID, OTHER_DEVICE_ID, OTHER_DEVICE_ID]);

    expect(count).toBe(2);
    expect(prisma.alertDelivery.createMany).toHaveBeenCalledWith({
      data: [{ warningId: WARNING_ID, deviceId: OTHER_DEVICE_ID, acknowledgedAt: null }],
    });
  });

  it('writes nothing when every device already has it', async () => {
    prisma.alertDelivery.findMany.mockResolvedValue([{ deviceId: DEVICE_ID }]);

    await expect(deliveries.recordDelivered(WARNING_ID, [DEVICE_ID])).resolves.toBe(1);
    expect(prisma.alertDelivery.createMany).not.toHaveBeenCalled();
  });

  it('acknowledges once and returns the delivery', async () => {
    prisma.alertDelivery.updateMany.mockResolvedValue({ count: 1 });
    prisma.alertDelivery.findUnique.mockResolvedValue({
      id: 'd1', warningId: WARNING_ID, deviceId: DEVICE_ID, deliveredAt: NOW, acknowledgedAt: NOW,
    });

    const result = await deliveries.acknowledge(WARNING_ID, DEVICE_ID, NOW);

    expect(result?.acknowledgedAt).toEqual(NOW);
    expect(prisma.alertDelivery.updateMany).toHaveBeenCalledWith({
      where: { warningId: WARNING_ID, deviceId: DEVICE_ID, acknowledgedAt: null },
      data: { acknowledgedAt: NOW },
    });
  });

  it('returns null for a warning never delivered to the device, or a malformed id', async () => {
    prisma.alertDelivery.updateMany.mockResolvedValue({ count: 0 });
    prisma.alertDelivery.findUnique.mockResolvedValue(null);

    await expect(deliveries.acknowledge(WARNING_ID, DEVICE_ID, NOW)).resolves.toBeNull();
    await expect(deliveries.acknowledge('bad', DEVICE_ID, NOW)).resolves.toBeNull();
  });

  it('lists a device deliveries newest first and counts acknowledgements', async () => {
    prisma.alertDelivery.findMany.mockResolvedValue([]);
    prisma.alertDelivery.count.mockResolvedValue(3);

    await deliveries.listForDevice(DEVICE_ID, 50);
    expect(prisma.alertDelivery.findMany).toHaveBeenCalledWith({
      where: { deviceId: DEVICE_ID },
      orderBy: { deliveredAt: 'desc' },
      take: 50,
    });
    await expect(deliveries.countAcknowledged(WARNING_ID)).resolves.toBe(3);
    expect(prisma.alertDelivery.count).toHaveBeenCalledWith({
      where: { warningId: WARNING_ID, acknowledgedAt: { not: null } },
    });
  });
});
```

Run: `cd apps/api && bunx vitest run src/citizens`
Expected: FAIL (modules not found).

- [ ] **Step 7: Implement the citizen storage**

`apps/api/src/citizens/infrastructure/prisma-citizen-directory.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { Citizen as CitizenRow } from '@prisma/client';

import type { District } from '@repo/types';

import { PrismaService } from '../../prisma/prisma.service.js';
import { isUniqueViolation } from '../../prisma/references.js';
import type { CitizenEntity } from '../citizen.entity.js';
import type {
  CitizenDirectory,
  Recipient,
  RecipientCount,
} from '../citizen-directory.js';

function toEntity(row: CitizenRow): CitizenEntity {
  return {
    id: row.id,
    deviceId: row.deviceId,
    // Stored as a string; the DTO only lets District codes in.
    district: row.district as District,
    phone: row.phone ?? undefined,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaCitizenDirectory implements CitizenDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async register(deviceId: string, district: District, phone?: string): Promise<CitizenEntity> {
    const data = { district, phone: phone ?? null };
    try {
      const row = await this.prisma.citizen.upsert({
        where: { deviceId },
        create: { deviceId, ...data },
        update: data,
      });
      return toEntity(row);
    } catch (error) {
      // Two first registrations from the same device can race on the unique id.
      if (!isUniqueViolation(error, 'deviceId')) throw error;
      return toEntity(await this.prisma.citizen.update({ where: { deviceId }, data }));
    }
  }

  async findByDeviceId(deviceId: string): Promise<CitizenEntity | null> {
    const row = await this.prisma.citizen.findUnique({ where: { deviceId } });
    return row && toEntity(row);
  }

  async findInDistricts(districts: District[]): Promise<Recipient[]> {
    const rows = await this.prisma.citizen.findMany({ where: { district: { in: districts } } });
    return rows.map((row) => {
      const { deviceId, district, phone } = toEntity(row);
      return { deviceId, district, phone };
    });
  }

  async countInDistricts(districts: District[]): Promise<RecipientCount> {
    const where = { district: { in: districts } };
    const [groups, withPhone] = await Promise.all([
      this.prisma.citizen.groupBy({ by: ['district'], where, _count: { _all: true } }),
      this.prisma.citizen.count({ where: { ...where, phone: { not: null } } }),
    ]);

    const byDistrict: Partial<Record<District, number>> = {};
    for (const district of districts) byDistrict[district] = 0;
    let total = 0;
    for (const group of groups) {
      byDistrict[group.district as District] = group._count._all;
      total += group._count._all;
    }
    return { total, withPhone, byDistrict };
  }
}
```

`apps/api/src/citizens/infrastructure/prisma-alert-delivery.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { AlertDelivery as AlertDeliveryRow } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import { isUniqueViolation } from '../../prisma/references.js';
import type { AlertDeliveryRepository } from '../alert-delivery.repository.js';
import type { AlertDeliveryEntity } from '../citizen.entity.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

function toEntity(row: AlertDeliveryRow): AlertDeliveryEntity {
  return {
    id: row.id,
    warningId: row.warningId,
    deviceId: row.deviceId,
    deliveredAt: row.deliveredAt,
    acknowledgedAt: row.acknowledgedAt ?? undefined,
  };
}

@Injectable()
export class PrismaAlertDeliveryRepository implements AlertDeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordDelivered(warningId: string, deviceIds: string[]): Promise<number> {
    const unique = [...new Set(deviceIds)];
    if (unique.length === 0) return 0;

    const existing = await this.prisma.alertDelivery.findMany({
      where: { warningId, deviceId: { in: unique } },
      select: { deviceId: true },
    });
    const have = new Set(existing.map((row) => row.deviceId));
    const missing = unique.filter((deviceId) => !have.has(deviceId));

    if (missing.length > 0) {
      try {
        await this.prisma.alertDelivery.createMany({
          // acknowledgedAt is written as null so "not acknowledged" can be queried.
          data: missing.map((deviceId) => ({ warningId, deviceId, acknowledgedAt: null })),
        });
      } catch (error) {
        // A parallel send delivered some of these first; they are delivered either way.
        if (!isUniqueViolation(error, 'warningId')) throw error;
      }
    }
    return unique.length;
  }

  async listForDevice(deviceId: string, limit: number): Promise<AlertDeliveryEntity[]> {
    const rows = await this.prisma.alertDelivery.findMany({
      where: { deviceId },
      orderBy: { deliveredAt: 'desc' },
      take: limit,
    });
    return rows.map(toEntity);
  }

  async acknowledge(warningId: string, deviceId: string, at: Date): Promise<AlertDeliveryEntity | null> {
    if (!OBJECT_ID.test(warningId)) return null;
    await this.prisma.alertDelivery.updateMany({
      where: { warningId, deviceId, acknowledgedAt: null },
      data: { acknowledgedAt: at },
    });
    const row = await this.prisma.alertDelivery.findUnique({
      where: { warningId_deviceId: { warningId, deviceId } },
    });
    return row && toEntity(row);
  }

  countAcknowledged(warningId: string): Promise<number> {
    return this.prisma.alertDelivery.count({
      where: { warningId, acknowledgedAt: { not: null } },
    });
  }
}
```

Run: `cd apps/api && bunx vitest run src/citizens && bun run check-types`
Expected: PASS.

- [ ] **Step 8: Integration test against `dws_test`** — `apps/api/src/hazard-warnings/infrastructure/prisma-warnings.integration.spec.ts` (copy the skip-and-connect pattern from `prisma-hazard-report.repository.integration.spec.ts`)

```ts
import { canRunIntegration, createTestPrisma } from '../../testing/integration.js';
import { PrismaAlertDeliveryRepository } from '../../citizens/infrastructure/prisma-alert-delivery.repository.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { initialChannels } from '../domain/warning-rules.js';
import { DEVICE_ID, warningEntity } from '../testing/fixtures.js';
import { PrismaHazardWarningRepository } from './prisma-hazard-warning.repository.js';

describe.skipIf(!canRunIntegration)('warning storage on dws_test', () => {
  let prisma: PrismaService;
  let warnings: PrismaHazardWarningRepository;
  let deliveries: PrismaAlertDeliveryRepository;

  beforeAll(async () => {
    prisma = createTestPrisma();
    await prisma.$connect();
    warnings = new PrismaHazardWarningRepository(prisma);
    deliveries = new PrismaAlertDeliveryRepository(prisma);
  });

  beforeEach(async () => {
    await prisma.alertDelivery.deleteMany();
    await prisma.notificationLog.deleteMany();
    await prisma.hazardWarning.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function issued() {
    const { warning } = await warnings.create({
      ...warningEntity({ validFrom: new Date(), validUntil: new Date(Date.now() + 12 * 3600_000) }),
      clientRequestId: crypto.randomUUID(),
      createdBy: 'Officer Silva',
      status: 'DISSEMINATING',
      issuedBy: 'Officer Silva',
      issuedAt: new Date(),
      channels: initialChannels(),
    });
    return warnings.recordDissemination(warning.id, initialChannels(), 'DISSEMINATED');
  }

  it('lets exactly one of two concurrent cancels win', async () => {
    const warning = await issued();
    const input = { cancelledBy: 'Officer Silva', reason: 'Water receded', cancelledAt: new Date() };

    const results = await Promise.all([warnings.cancel(warning.id, input), warnings.cancel(warning.id, input)]);

    expect(results.map((r) => r.outcome).sort()).toEqual(['UPDATED', 'WRONG_STATE']);
  });

  it('returns the first warning when the same clientRequestId is created twice', async () => {
    const input = {
      ...warningEntity(),
      clientRequestId: crypto.randomUUID(),
      createdBy: 'Officer Silva',
      status: 'DRAFT' as const,
      channels: [],
    };
    const [first, second] = await Promise.all([warnings.create(input), warnings.create(input)]);

    expect(first.warning.id).toBe(second.warning.id);
    expect([first.created, second.created].sort()).toEqual([false, true]);
  });

  it('delivers to a device once and acknowledges once', async () => {
    const warning = await issued();

    await deliveries.recordDelivered(warning.id, [DEVICE_ID]);
    await deliveries.recordDelivered(warning.id, [DEVICE_ID]);
    const first = await deliveries.acknowledge(warning.id, DEVICE_ID, new Date('2026-10-07T09:00:00Z'));
    const second = await deliveries.acknowledge(warning.id, DEVICE_ID, new Date('2026-10-07T10:00:00Z'));

    expect(await prisma.alertDelivery.count({ where: { warningId: warning.id } })).toBe(1);
    expect(second?.acknowledgedAt).toEqual(first?.acknowledgedAt);
    expect(await deliveries.countAcknowledged(warning.id)).toBe(1);
  });

  it('finds an overlapping active warning by shared district', async () => {
    const warning = await issued();

    const found = await warnings.findActiveOverlapping({ hazardType: 'FLOOD', districts: ['GAMPAHA', 'KANDY'], now: new Date() });

    expect(found.map((w) => w.id)).toEqual([warning.id]);
  });
});
```

Run: `cd apps/api && bunx vitest run --project database src/hazard-warnings`
Expected: PASS with `DATABASE_URL_TEST` set; skipped (not failed) without it. `issued()` uses the real clock so the warning is active whenever the suite runs.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/citizens apps/api/src/hazard-warnings
git commit -m "feat(api): add warning, log, citizen and delivery repositories"
```

---
### Task 5: Dissemination: channels (Strategy) and the disseminator

**Files:**
- Create in `apps/api/src/hazard-warnings/dissemination/`: `notification-channel.ts`, `channel-failure-switch.ts`, `in-app-push.channel.ts`, `sms.channel.ts`, `audible-alert.channel.ts`, `warning-disseminator.ts`, `channels.spec.ts`, `warning-disseminator.spec.ts`

**Interfaces:**
- Consumes: `CitizenDirectory`, `Recipient`, `CITIZEN_DIRECTORY`, `AlertDeliveryRepository`, `ALERT_DELIVERY_REPOSITORY` (Task 4); `NotificationLogRepository`, `NOTIFICATION_LOG_REPOSITORY` (Task 4); `warningMessage`, `allClearMessage` (Task 3); `Env.SIMULATE_CHANNEL_FAILURE` (Task 2).
- Produces:

```ts
export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');
export interface ChannelMessage { warningId: string; kind: MessageKind; text: string; districts: District[] }
export interface ChannelResult { recipients: number; delivered: number }
export interface NotificationChannel { readonly kind: ChannelKind; send(message: ChannelMessage, recipients: Recipient[]): Promise<ChannelResult> }
export class ChannelUnavailableError extends Error {}
export class ChannelFailureSwitch { check(kind: ChannelKind): void }   // throws ChannelUnavailableError
export class InAppPushChannel, SmsChannel, AudibleAlertChannel implements NotificationChannel
export class WarningDisseminator {
  send(warning: HazardWarningEntity, kinds: readonly ChannelKind[], now?: Date): Promise<DisseminationChannelState[]>;  // never throws
  announceAllClear(warning: HazardWarningEntity): Promise<void>;  // never throws
}
export const DIRECTORY_UNAVAILABLE = 'Notification service is temporarily unavailable.';
```

- [ ] **Step 1: Create `notification-channel.ts` and `channel-failure-switch.ts`**

```ts
// notification-channel.ts
import type { ChannelKind, District, MessageKind } from '@repo/types';

import type { Recipient } from '../../citizens/citizen-directory.js';

/** Injection token for the list of every channel a warning is sent on. */
export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

export interface ChannelMessage {
  warningId: string;
  kind: MessageKind;
  text: string;
  districts: District[];
}

export interface ChannelResult {
  /** Who this channel could reach. 0 means the channel is skipped. */
  recipients: number;
  delivered: number;
}

/**
 * One way of reaching citizens (Strategy). Adding a channel, such as radio,
 * means adding a class and listing it in the module; nothing else changes.
 * A failure is a thrown error, which the disseminator records.
 */
export interface NotificationChannel {
  readonly kind: ChannelKind;
  send(message: ChannelMessage, recipients: Recipient[]): Promise<ChannelResult>;
}
```

```ts
// channel-failure-switch.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CHANNEL_LABELS, type ChannelKind } from '@repo/types';

import type { Env } from '../../config/env.js';

export class ChannelUnavailableError extends Error {
  constructor(kind: ChannelKind) {
    super(`${CHANNEL_LABELS[kind]} gateway is unavailable`);
    this.name = 'ChannelUnavailableError';
  }
}

/**
 * The SMS and siren gateways are simulated. SIMULATE_CHANNEL_FAILURE makes a
 * gateway refuse, so partial dissemination and retry can be demonstrated.
 */
@Injectable()
export class ChannelFailureSwitch {
  private readonly failing: ReadonlySet<ChannelKind>;

  constructor(config: ConfigService<Env, true>) {
    this.failing = new Set(config.get('SIMULATE_CHANNEL_FAILURE', { infer: true }));
  }

  check(kind: ChannelKind): void {
    if (this.failing.has(kind)) throw new ChannelUnavailableError(kind);
  }
}
```

- [ ] **Step 2: Write failing channel tests** — `channels.spec.ts`

```ts
import type { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import { DEVICE_ID, fakeDeliveries, OTHER_DEVICE_ID, WARNING_ID } from '../testing/fixtures.js';
import { AudibleAlertChannel } from './audible-alert.channel.js';
import { ChannelFailureSwitch, ChannelUnavailableError } from './channel-failure-switch.js';
import { InAppPushChannel } from './in-app-push.channel.js';
import type { ChannelMessage } from './notification-channel.js';
import { SmsChannel } from './sms.channel.js';

function failures(...kinds: string[]) {
  const config = { get: () => kinds } as unknown as ConfigService<Env, true>;
  return new ChannelFailureSwitch(config);
}

const warning: ChannelMessage = {
  warningId: WARNING_ID,
  kind: 'WARNING',
  text: 'HIGH Flood warning',
  districts: ['COLOMBO', 'GAMPAHA'],
};
const recipients = [
  { deviceId: DEVICE_ID, district: 'COLOMBO' as const, phone: '+94771234567' },
  { deviceId: OTHER_DEVICE_ID, district: 'GAMPAHA' as const },
];

describe('ChannelFailureSwitch', () => {
  it('throws only for the configured channels', () => {
    const toggle = failures('SMS');
    expect(() => toggle.check('PUSH')).not.toThrow();
    expect(() => toggle.check('SMS')).toThrow(new ChannelUnavailableError('SMS'));
    expect(() => toggle.check('SMS')).toThrow('SMS gateway is unavailable');
  });
});

describe('InAppPushChannel', () => {
  it('records a delivery for every recipient device', async () => {
    const deliveries = fakeDeliveries();
    const channel = new InAppPushChannel(deliveries, failures());

    await expect(channel.send(warning, recipients)).resolves.toEqual({ recipients: 2, delivered: 2 });
    expect(deliveries.recordDelivered).toHaveBeenCalledWith(WARNING_ID, [DEVICE_ID, OTHER_DEVICE_ID]);
  });

  it('writes nothing for an All Clear: phones see the cancellation on their next check', async () => {
    const deliveries = fakeDeliveries();
    const channel = new InAppPushChannel(deliveries, failures());

    await expect(channel.send({ ...warning, kind: 'ALL_CLEAR' }, recipients)).resolves.toEqual({ recipients: 2, delivered: 2 });
    expect(deliveries.recordDelivered).not.toHaveBeenCalled();
  });

  it('fails when its gateway is switched off', async () => {
    const channel = new InAppPushChannel(fakeDeliveries(), failures('PUSH'));
    await expect(channel.send(warning, recipients)).rejects.toThrow('Push Notification gateway is unavailable');
  });
});

describe('SmsChannel', () => {
  it('texts only the recipients who gave a phone number', async () => {
    const channel = new SmsChannel(failures());
    await expect(channel.send(warning, recipients)).resolves.toEqual({ recipients: 1, delivered: 1 });
  });

  it('reaches nobody when no recipient has a phone', async () => {
    const channel = new SmsChannel(failures());
    await expect(channel.send(warning, [recipients[1]!])).resolves.toEqual({ recipients: 0, delivered: 0 });
  });

  it('fails when its gateway is switched off', async () => {
    await expect(new SmsChannel(failures('SMS')).send(warning, recipients)).rejects.toThrow(ChannelUnavailableError);
  });
});

describe('AudibleAlertChannel', () => {
  it('sounds one siren network per district, whoever is registered', async () => {
    const channel = new AudibleAlertChannel(failures());
    await expect(channel.send(warning, [])).resolves.toEqual({ recipients: 2, delivered: 2 });
  });

  it('fails when its gateway is switched off', async () => {
    await expect(new AudibleAlertChannel(failures('AUDIBLE')).send(warning, [])).rejects.toThrow(ChannelUnavailableError);
  });
});
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings/dissemination/channels.spec.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the three channels**

```ts
// in-app-push.channel.ts
import { Inject, Injectable } from '@nestjs/common';

import { ALERT_DELIVERY_REPOSITORY } from '../../citizens/alert-delivery.repository.js';
import type { AlertDeliveryRepository } from '../../citizens/alert-delivery.repository.js';
import type { Recipient } from '../../citizens/citizen-directory.js';
import { ChannelFailureSwitch } from './channel-failure-switch.js';
import type { ChannelMessage, ChannelResult, NotificationChannel } from './notification-channel.js';

/** The real channel: a delivery row per device, which the citizen app polls. */
@Injectable()
export class InAppPushChannel implements NotificationChannel {
  readonly kind = 'PUSH' as const;

  constructor(
    @Inject(ALERT_DELIVERY_REPOSITORY) private readonly deliveries: AlertDeliveryRepository,
    private readonly failures: ChannelFailureSwitch,
  ) {}

  async send(message: ChannelMessage, recipients: Recipient[]): Promise<ChannelResult> {
    this.failures.check(this.kind);
    if (message.kind === 'ALL_CLEAR') {
      // The phones that hold the warning see it cancelled on their next check.
      return { recipients: recipients.length, delivered: recipients.length };
    }
    const delivered = await this.deliveries.recordDelivered(
      message.warningId,
      recipients.map((recipient) => recipient.deviceId),
    );
    return { recipients: recipients.length, delivered };
  }
}
```

```ts
// sms.channel.ts
import { Injectable, Logger } from '@nestjs/common';

import type { Recipient } from '../../citizens/citizen-directory.js';
import { ChannelFailureSwitch } from './channel-failure-switch.js';
import type { ChannelMessage, ChannelResult, NotificationChannel } from './notification-channel.js';

/** Simulated SMS gateway: accepts every message unless switched off. */
@Injectable()
export class SmsChannel implements NotificationChannel {
  readonly kind = 'SMS' as const;
  private readonly logger = new Logger(SmsChannel.name);

  constructor(private readonly failures: ChannelFailureSwitch) {}

  async send(message: ChannelMessage, recipients: Recipient[]): Promise<ChannelResult> {
    this.failures.check(this.kind);
    const reachable = recipients.filter((recipient) => recipient.phone !== undefined);
    this.logger.log(`Simulated SMS to ${reachable.length} phones: ${message.text}`);
    return { recipients: reachable.length, delivered: reachable.length };
  }
}
```

```ts
// audible-alert.channel.ts
import { Injectable, Logger } from '@nestjs/common';

import { ChannelFailureSwitch } from './channel-failure-switch.js';
import type { ChannelMessage, ChannelResult, NotificationChannel } from './notification-channel.js';

/** Simulated siren network: one activation per affected district. */
@Injectable()
export class AudibleAlertChannel implements NotificationChannel {
  readonly kind = 'AUDIBLE' as const;
  private readonly logger = new Logger(AudibleAlertChannel.name);

  constructor(private readonly failures: ChannelFailureSwitch) {}

  async send(message: ChannelMessage): Promise<ChannelResult> {
    this.failures.check(this.kind);
    this.logger.log(`Simulated sirens in ${message.districts.join(', ')}`);
    return { recipients: message.districts.length, delivered: message.districts.length };
  }
}
```

Silence the `Logger.log` output in tests with `vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)` in a `beforeEach` (add `import { Logger } from '@nestjs/common'` to the spec).

Run: `cd apps/api && bunx vitest run src/hazard-warnings/dissemination/channels.spec.ts`
Expected: PASS.

- [ ] **Step 4: Write failing disseminator tests** — `warning-disseminator.spec.ts`

```ts
import { Logger } from '@nestjs/common';

import type { ChannelKind } from '@repo/types';

import {
  channel,
  DEVICE_ID,
  fakeDirectory,
  fakeLogRepository,
  issuedWarning,
  NOW,
  WARNING_ID,
} from '../testing/fixtures.js';
import type { NotificationChannel } from './notification-channel.js';
import { DIRECTORY_UNAVAILABLE, WarningDisseminator } from './warning-disseminator.js';

function fakeChannel(kind: ChannelKind, recipients = 2) {
  return {
    kind,
    send: vi.fn<NotificationChannel['send']>().mockResolvedValue({ recipients, delivered: recipients }),
  };
}

describe('WarningDisseminator', () => {
  let push: ReturnType<typeof fakeChannel>;
  let sms: ReturnType<typeof fakeChannel>;
  let audible: ReturnType<typeof fakeChannel>;
  let directory: ReturnType<typeof fakeDirectory>;
  let logs: ReturnType<typeof fakeLogRepository>;
  let disseminator: WarningDisseminator;

  beforeEach(() => {
    push = fakeChannel('PUSH');
    sms = fakeChannel('SMS', 0);
    audible = fakeChannel('AUDIBLE');
    directory = fakeDirectory();
    directory.findInDistricts.mockResolvedValue([{ deviceId: DEVICE_ID, district: 'COLOMBO' }]);
    logs = fakeLogRepository();
    disseminator = new WarningDisseminator([push, sms, audible], directory, logs);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('sends the warning text on every requested channel at once', async () => {
    const warning = issuedWarning({ channels: [] });

    const states = await disseminator.send(warning, ['PUSH', 'SMS', 'AUDIBLE'], NOW);

    expect(directory.findInDistricts).toHaveBeenCalledWith(['COLOMBO', 'GAMPAHA']);
    expect(push.send).toHaveBeenCalledWith(
      { warningId: WARNING_ID, kind: 'WARNING', text: expect.stringContaining('HIGH Flood warning'), districts: ['COLOMBO', 'GAMPAHA'] },
      [{ deviceId: DEVICE_ID, district: 'COLOMBO' }],
    );
    expect(states).toEqual([
      { channel: 'PUSH', state: 'SENT', recipients: 2, delivered: 2, attempts: 1, sentAt: NOW },
      { channel: 'SMS', state: 'SKIPPED', recipients: 0, delivered: 0, attempts: 1 },
      { channel: 'AUDIBLE', state: 'SENT', recipients: 2, delivered: 2, attempts: 1, sentAt: NOW },
    ]);
  });

  it('keeps sending on the other channels when one throws, and records why', async () => {
    sms.send.mockRejectedValue(new Error('SMS gateway is unavailable'));

    const states = await disseminator.send(issuedWarning({ channels: [] }), ['PUSH', 'SMS', 'AUDIBLE'], NOW);

    expect(states.map((s) => s.state)).toEqual(['SENT', 'FAILED', 'SENT']);
    expect(states[1]).toMatchObject({ lastError: 'SMS gateway is unavailable', delivered: 0 });
    expect(logs.record).toHaveBeenCalledWith({
      warningId: WARNING_ID,
      channel: 'SMS',
      kind: 'WARNING',
      outcome: 'FAILED',
      message: 'SMS failed: SMS gateway is unavailable',
      recipients: 0,
    });
    expect(logs.record).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'PUSH', outcome: 'SENT', message: 'Push notification delivered to 2 citizens' }),
    );
  });

  it('counts attempts on top of earlier ones and only uses the requested channels', async () => {
    const warning = issuedWarning({ channels: [channel('PUSH'), channel('SMS', { state: 'FAILED', attempts: 2 }), channel('AUDIBLE')] });

    const states = await disseminator.send(warning, ['SMS'], NOW);

    expect(states).toEqual([expect.objectContaining({ channel: 'SMS', attempts: 3 })]);
    expect(push.send).not.toHaveBeenCalled();
  });

  it('marks every channel failed when recipients cannot be looked up', async () => {
    directory.findInDistricts.mockRejectedValue(new Error('connection reset'));

    const states = await disseminator.send(issuedWarning({ channels: [] }), ['PUSH', 'SMS', 'AUDIBLE'], NOW);

    expect(states.every((s) => s.state === 'FAILED' && s.lastError === DIRECTORY_UNAVAILABLE)).toBe(true);
    expect(push.send).not.toHaveBeenCalled();
    expect(logs.record).toHaveBeenCalledTimes(3);
  });

  it('still returns the states when writing a log fails', async () => {
    logs.record.mockRejectedValue(new Error('db down'));

    const states = await disseminator.send(issuedWarning({ channels: [] }), ['PUSH'], NOW);

    expect(states[0]?.state).toBe('SENT');
  });

  it('announces an All Clear on every channel and logs it, without throwing', async () => {
    const cancelled = issuedWarning({
      status: 'CANCELLED',
      cancellation: { cancelledAt: NOW, cancelledBy: 'Officer Silva', reason: 'Water receded' },
    });
    audible.send.mockRejectedValue(new Error('sirens offline'));

    await expect(disseminator.announceAllClear(cancelled)).resolves.toBeUndefined();

    expect(push.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ALL_CLEAR' }), expect.any(Array));
    expect(logs.record).toHaveBeenCalledWith(expect.objectContaining({ channel: 'AUDIBLE', kind: 'ALL_CLEAR', outcome: 'FAILED' }));
    expect(logs.record).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'PUSH', kind: 'ALL_CLEAR', message: 'All Clear: Push notification delivered to 2 citizens' }),
    );
  });

  it('gives up quietly on the All Clear when recipients cannot be looked up', async () => {
    directory.findInDistricts.mockRejectedValue(new Error('down'));

    await expect(disseminator.announceAllClear(issuedWarning())).resolves.toBeUndefined();
    expect(push.send).not.toHaveBeenCalled();
  });
});
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings/dissemination/warning-disseminator.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 5: Implement `warning-disseminator.ts`**

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';

import { CHANNEL_LABELS, type ChannelKind, type MessageKind } from '@repo/types';

import { CITIZEN_DIRECTORY } from '../../citizens/citizen-directory.js';
import type { CitizenDirectory, Recipient } from '../../citizens/citizen-directory.js';
import type {
  DisseminationChannelState,
  HazardWarningEntity,
} from '../domain/hazard-warning.entity.js';
import { allClearMessage, warningMessage } from '../domain/warning-rules.js';
import { NOTIFICATION_LOG_REPOSITORY } from '../notification-log.repository.js';
import type { NewNotificationLog, NotificationLogRepository } from '../notification-log.repository.js';
import { NOTIFICATION_CHANNELS } from './notification-channel.js';
import type { ChannelMessage, ChannelResult, NotificationChannel } from './notification-channel.js';

export const DIRECTORY_UNAVAILABLE = 'Notification service is temporarily unavailable.';

const SENT_TEXT: Record<ChannelKind, (count: number) => string> = {
  PUSH: (count) => `Push notification delivered to ${count} citizens`,
  SMS: (count) => `SMS gateway confirmed ${count} deliveries`,
  AUDIBLE: (count) => `Audible alert network activated across ${count} districts`,
};

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** One line for Live Delivery Activity. */
function describeOutcome(kind: ChannelKind, outcome: PromiseSettledResult<ChannelResult>): string {
  if (outcome.status === 'rejected') return `${CHANNEL_LABELS[kind]} failed: ${errorText(outcome.reason)}`;
  if (outcome.value.recipients === 0) return `${CHANNEL_LABELS[kind]}: nobody to reach in the selected area`;
  return SENT_TEXT[kind](outcome.value.delivered);
}

/**
 * Sends a warning on several channels at once and turns every outcome into a
 * recorded channel state. It never throws: a failure is data the officer acts
 * on (Retry), not an error that would lose the stored warning.
 */
@Injectable()
export class WarningDisseminator {
  private readonly logger = new Logger(WarningDisseminator.name);

  constructor(
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: NotificationChannel[],
    @Inject(CITIZEN_DIRECTORY) private readonly citizens: CitizenDirectory,
    @Inject(NOTIFICATION_LOG_REPOSITORY) private readonly logs: NotificationLogRepository,
  ) {}

  async send(
    warning: HazardWarningEntity,
    kinds: readonly ChannelKind[],
    now = new Date(),
  ): Promise<DisseminationChannelState[]> {
    const selected = this.channels.filter((channel) => kinds.includes(channel.kind));
    const attempts = (kind: ChannelKind) =>
      (warning.channels.find((item) => item.channel === kind)?.attempts ?? 0) + 1;

    const message = this.message(warning, 'WARNING');
    const recipients = await this.recipients(warning);
    const outcomes = recipients
      ? await Promise.allSettled(selected.map((channel) => channel.send(message, recipients)))
      : selected.map((): PromiseSettledResult<ChannelResult> => ({ status: 'rejected', reason: new Error(DIRECTORY_UNAVAILABLE) }));

    return Promise.all(
      selected.map(async (channel, index) => {
        const outcome = outcomes[index]!;
        await this.log(warning.id, channel.kind, 'WARNING', outcome);
        return this.toState(channel.kind, outcome, attempts(channel.kind), now);
      }),
    );
  }

  /** Tells the same districts the warning is over. Best effort: outcomes are logged only. */
  async announceAllClear(warning: HazardWarningEntity): Promise<void> {
    const recipients = await this.recipients(warning);
    if (!recipients) return;

    const message = this.message(warning, 'ALL_CLEAR');
    const outcomes = await Promise.allSettled(this.channels.map((channel) => channel.send(message, recipients)));
    await Promise.all(
      this.channels.map((channel, index) => this.log(warning.id, channel.kind, 'ALL_CLEAR', outcomes[index]!)),
    );
  }

  private message(warning: HazardWarningEntity, kind: MessageKind): ChannelMessage {
    return {
      warningId: warning.id,
      kind,
      text: kind === 'WARNING' ? warningMessage(warning) : allClearMessage(warning),
      districts: warning.districts,
    };
  }

  /** Null when the directory cannot be reached: every channel then fails. */
  private async recipients(warning: HazardWarningEntity): Promise<Recipient[] | null> {
    try {
      return await this.citizens.findInDistricts(warning.districts);
    } catch (error) {
      this.logger.error(`Could not load recipients for ${warning.reference}: ${errorText(error)}`);
      return null;
    }
  }

  private toState(
    kind: ChannelKind,
    outcome: PromiseSettledResult<ChannelResult>,
    attempts: number,
    now: Date,
  ): DisseminationChannelState {
    if (outcome.status === 'rejected') {
      return { channel: kind, state: 'FAILED', recipients: 0, delivered: 0, attempts, lastError: errorText(outcome.reason) };
    }
    const { recipients, delivered } = outcome.value;
    if (recipients === 0) {
      return { channel: kind, state: 'SKIPPED', recipients, delivered, attempts };
    }
    return { channel: kind, state: 'SENT', recipients, delivered, attempts, sentAt: now };
  }

  /** A lost log line must never undo a delivery that already happened. */
  private async log(
    warningId: string,
    channel: ChannelKind,
    kind: MessageKind,
    outcome: PromiseSettledResult<ChannelResult>,
  ): Promise<void> {
    const text = describeOutcome(channel, outcome);
    const entry: NewNotificationLog = {
      warningId,
      channel,
      kind,
      outcome: outcome.status === 'fulfilled' ? 'SENT' : 'FAILED',
      message: kind === 'ALL_CLEAR' ? `All Clear: ${text}` : text,
      recipients: outcome.status === 'fulfilled' ? outcome.value.recipients : 0,
    };
    try {
      await this.logs.record(entry);
    } catch (error) {
      this.logger.warn(`Could not write the delivery log for ${warningId}: ${errorText(error)}`);
    }
  }
}
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings/dissemination && bun run check-types && bun run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/hazard-warnings/dissemination
git commit -m "feat(api): send warnings on push, SMS and audible channels"
```

---
### Task 6: Services: lifecycle commands, queries, citizen alerts, citizen registration

**Files:**
- Create: `apps/api/src/hazard-warnings/hazard-warnings.service.ts`, `hazard-warnings.service.spec.ts`
- Create: `apps/api/src/hazard-warnings/warning-queries.service.ts`, `warning-queries.service.spec.ts`
- Create: `apps/api/src/hazard-warnings/citizen-alerts.service.ts`, `citizen-alerts.service.spec.ts`
- Create: `apps/api/src/citizens/citizens.service.ts`, `apps/api/src/citizens/citizens.service.spec.ts`

**Interfaces:**
- Consumes: repositories (Task 4), `WarningDisseminator` (Task 5), rules and mappers (Task 3), `HAZARD_REPORT_REPOSITORY` + `HazardReportRepository` (existing, exported by `HazardReportsModule`), `startOfColomboDay` (existing `src/common/time.ts`).
- Produces:

```ts
// hazard-warnings.service.ts
export function toWarningContent(fields: WarningFields): WarningContent;
export interface CreateWarningResult { warning: HazardWarningEntity; created: boolean }   // re-exported from repository
export interface WarningPreviewResult { recipients: RecipientCount; duplicates: HazardWarningEntity[] }
export class HazardWarningsService {
  preview(fields: WarningFields, now?: Date): Promise<WarningPreviewResult>;
  create(input: CreateWarningInput, officer: string, now?: Date): Promise<CreateWarningResult>;
  updateDraft(id: string, fields: WarningFields): Promise<HazardWarningEntity>;
  deleteDraft(id: string): Promise<void>;
  issue(id: string, officer: string, force?: boolean, now?: Date): Promise<HazardWarningEntity>;
  retry(id: string, now?: Date): Promise<HazardWarningEntity>;
  cancel(id: string, officer: string, reason: string, now?: Date): Promise<HazardWarningEntity>;
}
// warning-queries.service.ts
export interface WarningDetail { warning: HazardWarningEntity; logs: NotificationLogEntity[]; acknowledged: number }
export class WarningQueriesService {
  list(view: WarningView, page: number, limit: number, now?: Date): Promise<Paginated<HazardWarningEntity>>;
  stats(now?: Date): Promise<WarningStats>;
  findOne(id: string): Promise<WarningDetail>;
  prefill(reportId: string): Promise<WarningPrefill>;
}
// citizen-alerts.service.ts
export class CitizenAlertsService {
  listMine(deviceId: string, now?: Date): Promise<CitizenAlertDto[]>;
  acknowledge(warningId: string, deviceId: string, now?: Date): Promise<CitizenAlertDto>;
}
// citizens/citizens.service.ts
export class CitizensService {
  register(deviceId: string, input: RegisterCitizenInput): Promise<CitizenEntity>;
  profile(deviceId: string): Promise<CitizenEntity>;
}
```

- [ ] **Step 1: Write failing command-service tests** — `hazard-warnings.service.spec.ts`

```ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import type { CreateWarningInput } from '@repo/types';

import type { WarningDisseminator } from './dissemination/warning-disseminator.js';
import { HazardWarningsService } from './hazard-warnings.service.js';
import {
  channel,
  CLIENT_REQUEST_ID,
  fakeDirectory,
  fakeWarningRepository,
  hoursFromNow,
  issuedWarning,
  NOW,
  OFFICER,
  OTHER_WARNING_ID,
  WARNING_ID,
  warningEntity,
} from './testing/fixtures.js';

const fields = {
  hazardType: 'FLOOD' as const,
  level: 'HIGH' as const,
  districts: ['COLOMBO' as const, 'GAMPAHA' as const],
  description: 'Heavy rainfall expected. Evacuate low-lying areas.',
  safetyInstructions: ['Move to higher ground immediately'],
  validUntil: hoursFromNow(12).toISOString(),
};
const issueInput: CreateWarningInput = { ...fields, clientRequestId: CLIENT_REQUEST_ID, action: 'ISSUE' };

function fakeDisseminator() {
  return {
    send: vi.fn<WarningDisseminator['send']>().mockImplementation(async (_w, kinds) =>
      kinds.map((kind) => channel(kind)),
    ),
    announceAllClear: vi.fn<WarningDisseminator['announceAllClear']>().mockResolvedValue(undefined),
  };
}

describe('HazardWarningsService', () => {
  let warnings: ReturnType<typeof fakeWarningRepository>;
  let directory: ReturnType<typeof fakeDirectory>;
  let disseminator: ReturnType<typeof fakeDisseminator>;
  let service: HazardWarningsService;

  beforeEach(() => {
    warnings = fakeWarningRepository();
    directory = fakeDirectory();
    disseminator = fakeDisseminator();
    warnings.findByClientRequestId.mockResolvedValue(null);
    warnings.findActiveOverlapping.mockResolvedValue([]);
    warnings.create.mockImplementation(async (input) => ({
      warning: warningEntity({ ...input, status: input.status, channels: input.channels }),
      created: true,
    }));
    warnings.recordDissemination.mockImplementation(async (_id, channels, status) =>
      issuedWarning({ channels, status }),
    );
    service = new HazardWarningsService(warnings, directory, disseminator as unknown as WarningDisseminator);
  });

  describe('preview', () => {
    it('returns the recipient count and any overlapping active warning', async () => {
      const count = { total: 5, withPhone: 3, byDistrict: { COLOMBO: 5, GAMPAHA: 0 } };
      directory.countInDistricts.mockResolvedValue(count);
      warnings.findActiveOverlapping.mockResolvedValue([issuedWarning({ id: OTHER_WARNING_ID })]);

      const preview = await service.preview(fields, NOW);

      expect(preview.recipients).toEqual(count);
      expect(preview.duplicates).toHaveLength(1);
      expect(warnings.findActiveOverlapping).toHaveBeenCalledWith({ hazardType: 'FLOOD', districts: ['COLOMBO', 'GAMPAHA'], now: NOW });
    });

    it('rejects details that could not be issued', async () => {
      await expect(service.preview({ ...fields, description: undefined }, NOW)).rejects.toThrow(
        new BadRequestException('description is required to issue a warning'),
      );
    });
  });

  describe('create', () => {
    it('saves a draft without sending anything', async () => {
      const result = await service.create(
        { hazardType: 'FLOOD', level: 'LOW', districts: ['KANDY'], clientRequestId: CLIENT_REQUEST_ID, action: 'DRAFT' },
        OFFICER,
        NOW,
      );

      expect(result.created).toBe(true);
      expect(warnings.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'DRAFT', channels: [], createdBy: OFFICER, safetyInstructions: [] }),
      );
      expect(disseminator.send).not.toHaveBeenCalled();
    });

    it('rejects a draft whose period ends before it starts', async () => {
      await expect(
        service.create(
          { ...issueInput, action: 'DRAFT', validFrom: hoursFromNow(5).toISOString(), validUntil: hoursFromNow(1).toISOString() },
          OFFICER,
          NOW,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('issues: stores as disseminating, sends on every channel, records the result', async () => {
      const result = await service.create(issueInput, OFFICER, NOW);

      expect(warnings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DISSEMINATING',
          issuedBy: OFFICER,
          issuedAt: NOW,
          validFrom: NOW,
          channels: expect.arrayContaining([expect.objectContaining({ state: 'PENDING' })]),
        }),
      );
      expect(disseminator.send).toHaveBeenCalledWith(expect.any(Object), ['PUSH', 'SMS', 'AUDIBLE'], NOW);
      expect(warnings.recordDissemination).toHaveBeenCalledWith(
        WARNING_ID,
        [channel('PUSH'), channel('SMS'), channel('AUDIBLE')],
        'DISSEMINATED',
      );
      expect(result).toEqual({ warning: expect.objectContaining({ status: 'DISSEMINATED' }), created: true });
    });

    it('records PARTIALLY_DISSEMINATED when a channel failed', async () => {
      disseminator.send.mockResolvedValue([channel('PUSH'), channel('SMS', { state: 'FAILED' }), channel('AUDIBLE')]);

      await service.create(issueInput, OFFICER, NOW);

      expect(warnings.recordDissemination).toHaveBeenCalledWith(WARNING_ID, expect.any(Array), 'PARTIALLY_DISSEMINATED');
    });

    it('lists every missing detail before issuing', async () => {
      await expect(
        service.create({ ...issueInput, description: undefined, safetyInstructions: [] }, OFFICER, NOW),
      ).rejects.toThrow('description is required to issue a warning; add at least one safety instruction');
      expect(warnings.create).not.toHaveBeenCalled();
    });

    it('refuses a duplicate active warning unless forced', async () => {
      warnings.findActiveOverlapping.mockResolvedValue([issuedWarning({ id: OTHER_WARNING_ID, reference: 'HW-2026-0009' })]);

      await expect(service.create(issueInput, OFFICER, NOW)).rejects.toThrow(
        new ConflictException(
          'An active HIGH Flood warning (HW-2026-0009) already covers Colombo, Gampaha. Review it, or confirm to issue anyway.',
        ),
      );

      await service.create({ ...issueInput, force: true }, OFFICER, NOW);
      expect(warnings.create).toHaveBeenCalledTimes(1);
    });

    it('replays a create with the same clientRequestId without sending again', async () => {
      warnings.findByClientRequestId.mockResolvedValue(issuedWarning());

      const result = await service.create(issueInput, OFFICER, NOW);

      expect(result).toEqual({ warning: issuedWarning(), created: false });
      expect(warnings.create).not.toHaveBeenCalled();
      expect(disseminator.send).not.toHaveBeenCalled();
    });

    it('does not send when it lost a create race to an identical request', async () => {
      warnings.create.mockResolvedValue({ warning: issuedWarning(), created: false });

      await service.create(issueInput, OFFICER, NOW);

      expect(disseminator.send).not.toHaveBeenCalled();
    });
  });

  describe('drafts', () => {
    it('updates a draft', async () => {
      warnings.updateDraft.mockResolvedValue({ outcome: 'UPDATED', warning: warningEntity() });

      await expect(service.updateDraft(WARNING_ID, fields)).resolves.toEqual(warningEntity());
      expect(warnings.updateDraft).toHaveBeenCalledWith(WARNING_ID, expect.objectContaining({ validUntil: hoursFromNow(12) }));
    });

    it('refuses to edit an issued warning, and 404s an unknown one', async () => {
      warnings.updateDraft.mockResolvedValueOnce({ outcome: 'WRONG_STATE', warning: issuedWarning() });
      await expect(service.updateDraft(WARNING_ID, fields)).rejects.toThrow(new ConflictException('Only a draft can be edited'));

      warnings.updateDraft.mockResolvedValueOnce({ outcome: 'NOT_FOUND' });
      await expect(service.updateDraft(WARNING_ID, fields)).rejects.toThrow(NotFoundException);
    });

    it.each([
      ['DELETED', undefined],
      ['NOT_DRAFT', ConflictException],
      ['NOT_FOUND', NotFoundException],
    ] as const)('maps delete outcome %s', async (outcome, error) => {
      warnings.deleteDraft.mockResolvedValue(outcome);
      const run = service.deleteDraft(WARNING_ID);
      if (error) await expect(run).rejects.toThrow(error);
      else await expect(run).resolves.toBeUndefined();
    });
  });

  describe('issue a draft', () => {
    beforeEach(() => {
      warnings.findById.mockResolvedValue(warningEntity({ validFrom: undefined }));
      warnings.startDissemination.mockResolvedValue({ outcome: 'UPDATED', warning: warningEntity({ status: 'DISSEMINATING' }) });
    });

    it('starts dissemination from DRAFT and sends', async () => {
      await service.issue(WARNING_ID, OFFICER, false, NOW);

      expect(warnings.startDissemination).toHaveBeenCalledWith(WARNING_ID, ['DRAFT'], {
        issuedBy: OFFICER,
        issuedAt: NOW,
        validFrom: NOW,
        channels: expect.any(Array),
      });
      expect(disseminator.send).toHaveBeenCalled();
    });

    it('refuses a draft that is incomplete', async () => {
      warnings.findById.mockResolvedValue(warningEntity({ safetyInstructions: [] }));
      await expect(service.issue(WARNING_ID, OFFICER, false, NOW)).rejects.toThrow('add at least one safety instruction');
    });

    it('checks duplicates excluding itself', async () => {
      await service.issue(WARNING_ID, OFFICER, false, NOW);
      expect(warnings.findActiveOverlapping).toHaveBeenCalledWith(expect.objectContaining({ excludeId: WARNING_ID }));
    });

    it('refuses something that is not a draft, and a second concurrent issue', async () => {
      warnings.findById.mockResolvedValueOnce(issuedWarning());
      await expect(service.issue(WARNING_ID, OFFICER, false, NOW)).rejects.toThrow(new ConflictException('Only a draft can be issued'));

      warnings.startDissemination.mockResolvedValueOnce({ outcome: 'WRONG_STATE', warning: issuedWarning() });
      await expect(service.issue(WARNING_ID, OFFICER, false, NOW)).rejects.toThrow(ConflictException);
      expect(disseminator.send).not.toHaveBeenCalled();
    });

    it('404s an unknown warning', async () => {
      warnings.findById.mockResolvedValue(null);
      await expect(service.issue(WARNING_ID, OFFICER, false, NOW)).rejects.toThrow(new NotFoundException('Warning not found'));
    });
  });

  describe('retry', () => {
    const partial = issuedWarning({
      status: 'PARTIALLY_DISSEMINATED',
      channels: [channel('PUSH'), channel('SMS', { state: 'FAILED' }), channel('AUDIBLE')],
    });

    it('re-sends only the failed channels and merges the result', async () => {
      warnings.findById.mockResolvedValue(partial);
      warnings.startDissemination.mockResolvedValue({ outcome: 'UPDATED', warning: { ...partial, status: 'DISSEMINATING' } });

      await service.retry(WARNING_ID, NOW);

      expect(warnings.startDissemination).toHaveBeenCalledWith(WARNING_ID, ['PARTIALLY_DISSEMINATED', 'PENDING_DISSEMINATION'], {});
      expect(disseminator.send).toHaveBeenCalledWith(expect.any(Object), ['SMS'], NOW);
      expect(warnings.recordDissemination).toHaveBeenCalledWith(
        WARNING_ID,
        [channel('PUSH'), channel('SMS'), channel('AUDIBLE')],
        'DISSEMINATED',
      );
    });

    it('refuses when nothing failed', async () => {
      warnings.findById.mockResolvedValue(issuedWarning());
      await expect(service.retry(WARNING_ID, NOW)).rejects.toThrow(
        new ConflictException('There is nothing to retry for this warning'),
      );
    });

    it('refuses when another officer already started a retry', async () => {
      warnings.findById.mockResolvedValue(partial);
      warnings.startDissemination.mockResolvedValue({ outcome: 'WRONG_STATE', warning: partial });
      await expect(service.retry(WARNING_ID, NOW)).rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    it('cancels and announces the All Clear', async () => {
      const cancelled = issuedWarning({ status: 'CANCELLED' });
      warnings.cancel.mockResolvedValue({ outcome: 'UPDATED', warning: cancelled });

      await expect(service.cancel(WARNING_ID, OFFICER, 'Water receded', NOW)).resolves.toBe(cancelled);
      expect(warnings.cancel).toHaveBeenCalledWith(WARNING_ID, { cancelledBy: OFFICER, reason: 'Water receded', cancelledAt: NOW });
      expect(disseminator.announceAllClear).toHaveBeenCalledWith(cancelled);
    });

    it('cancel lost race returns 409 and sends no second All Clear', async () => {
      warnings.cancel.mockResolvedValue({ outcome: 'WRONG_STATE', warning: issuedWarning({ status: 'CANCELLED' }) });

      await expect(service.cancel(WARNING_ID, OFFICER, 'Water receded', NOW)).rejects.toThrow(
        new ConflictException('This warning is not active, so it cannot be cancelled'),
      );
      expect(disseminator.announceAllClear).not.toHaveBeenCalled();
    });
  });
});
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings/hazard-warnings.service.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: Implement `hazard-warnings.service.ts`**

```ts
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  CHANNEL_KINDS,
  HAZARD_TYPE_LABELS,
  type ChannelKind,
  type CreateWarningInput,
  type WarningFields,
} from '@repo/types';

import { CITIZEN_DIRECTORY } from '../citizens/citizen-directory.js';
import type { CitizenDirectory, RecipientCount } from '../citizens/citizen-directory.js';
import { WarningDisseminator } from './dissemination/warning-disseminator.js';
import type { HazardWarningEntity, WarningContent } from './domain/hazard-warning.entity.js';
import {
  contentProblems,
  describeDistricts,
  initialChannels,
  issueProblems,
  mergeChannels,
  overallStatus,
  RETRYABLE_STATUSES,
  retryableChannels,
} from './domain/warning-rules.js';
import { HAZARD_WARNING_REPOSITORY } from './hazard-warning.repository.js';
import type {
  CreateWarningResult,
  HazardWarningRepository,
  TransitionResult,
} from './hazard-warning.repository.js';

export interface WarningPreviewResult {
  recipients: RecipientCount;
  duplicates: HazardWarningEntity[];
}

export function toWarningContent(fields: WarningFields): WarningContent {
  return {
    hazardType: fields.hazardType,
    level: fields.level,
    description: fields.description,
    additionalInfo: fields.additionalInfo,
    safetyInstructions: fields.safetyInstructions ?? [],
    districts: fields.districts,
    validFrom: fields.validFrom ? new Date(fields.validFrom) : undefined,
    validUntil: fields.validUntil ? new Date(fields.validUntil) : undefined,
    sourceReportId: fields.sourceReportId,
  };
}

function reject(problems: string[]): void {
  if (problems.length > 0) throw new BadRequestException(problems.join('; '));
}

/**
 * The warning lifecycle: draft, issue, send, retry, cancel. Each change of
 * status goes through a conditional repository update, so two officers acting
 * on the same warning can never both succeed.
 */
@Injectable()
export class HazardWarningsService {
  constructor(
    @Inject(HAZARD_WARNING_REPOSITORY) private readonly warnings: HazardWarningRepository,
    @Inject(CITIZEN_DIRECTORY) private readonly citizens: CitizenDirectory,
    private readonly disseminator: WarningDisseminator,
  ) {}

  /** What the review screen shows before anything is stored. */
  async preview(fields: WarningFields, now = new Date()): Promise<WarningPreviewResult> {
    const content = toWarningContent(fields);
    reject(issueProblems(content, now));

    const [recipients, duplicates] = await Promise.all([
      this.citizens.countInDistricts(content.districts),
      this.warnings.findActiveOverlapping({ hazardType: content.hazardType, districts: content.districts, now }),
    ]);
    return { recipients, duplicates };
  }

  /** Saves a draft, or stores and sends at once. Repeating a clientRequestId returns the first result. */
  async create(input: CreateWarningInput, officer: string, now = new Date()): Promise<CreateWarningResult> {
    const existing = await this.warnings.findByClientRequestId(input.clientRequestId);
    if (existing) return { warning: existing, created: false };

    const content = toWarningContent(input);
    const base = { ...content, clientRequestId: input.clientRequestId, createdBy: officer };

    if (input.action === 'DRAFT') {
      reject(contentProblems(content));
      return this.warnings.create({ ...base, status: 'DRAFT', channels: [] });
    }

    reject(issueProblems(content, now));
    await this.refuseDuplicate(content, now, input.force);

    const result = await this.warnings.create({
      ...base,
      validFrom: content.validFrom ?? now,
      status: 'DISSEMINATING',
      issuedBy: officer,
      issuedAt: now,
      channels: initialChannels(),
    });
    // Lost a race to an identical request: that request does the sending.
    if (!result.created) return result;
    return { warning: await this.send(result.warning, CHANNEL_KINDS, now), created: true };
  }

  async updateDraft(id: string, fields: WarningFields): Promise<HazardWarningEntity> {
    const content = toWarningContent(fields);
    reject(contentProblems(content));
    return this.expectUpdated(await this.warnings.updateDraft(id, content), 'Only a draft can be edited');
  }

  async deleteDraft(id: string): Promise<void> {
    const outcome = await this.warnings.deleteDraft(id);
    if (outcome === 'NOT_FOUND') throw new NotFoundException('Warning not found');
    if (outcome === 'NOT_DRAFT') throw new ConflictException('Only a draft can be deleted');
  }

  async issue(id: string, officer: string, force = false, now = new Date()): Promise<HazardWarningEntity> {
    const draft = await this.require(id);
    if (draft.status !== 'DRAFT') throw new ConflictException('Only a draft can be issued');
    reject(issueProblems(draft, now));
    await this.refuseDuplicate(draft, now, force, id);

    const started = await this.warnings.startDissemination(id, ['DRAFT'], {
      issuedBy: officer,
      issuedAt: now,
      validFrom: draft.validFrom ?? now,
      channels: initialChannels(),
    });
    const warning = this.expectUpdated(started, 'Only a draft can be issued');
    return this.send(warning, CHANNEL_KINDS, now);
  }

  /** Sends again on the channels that failed, leaving the ones that worked alone. */
  async retry(id: string, now = new Date()): Promise<HazardWarningEntity> {
    const current = await this.require(id);
    const kinds = retryableChannels(current.channels);
    const retryable = (RETRYABLE_STATUSES as readonly string[]).includes(current.status);
    if (!retryable || kinds.length === 0) {
      throw new ConflictException('There is nothing to retry for this warning');
    }

    const started = await this.warnings.startDissemination(id, RETRYABLE_STATUSES, {});
    const warning = this.expectUpdated(started, 'There is nothing to retry for this warning');
    return this.send(warning, kinds, now);
  }

  async cancel(id: string, officer: string, reason: string, now = new Date()): Promise<HazardWarningEntity> {
    const result = await this.warnings.cancel(id, { cancelledBy: officer, reason, cancelledAt: now });
    const cancelled = this.expectUpdated(result, 'This warning is not active, so it cannot be cancelled');
    await this.disseminator.announceAllClear(cancelled);
    return cancelled;
  }

  private async send(
    warning: HazardWarningEntity,
    kinds: readonly ChannelKind[],
    now: Date,
  ): Promise<HazardWarningEntity> {
    const sent = await this.disseminator.send(warning, kinds, now);
    const channels = mergeChannels(warning.channels, sent);
    return this.warnings.recordDissemination(warning.id, channels, overallStatus(channels));
  }

  private async refuseDuplicate(
    content: WarningContent,
    now: Date,
    force = false,
    excludeId?: string,
  ): Promise<void> {
    if (force) return;
    const [duplicate] = await this.warnings.findActiveOverlapping({
      hazardType: content.hazardType,
      districts: content.districts,
      now,
      ...(excludeId && { excludeId }),
    });
    if (!duplicate) return;

    const hazard = HAZARD_TYPE_LABELS[duplicate.hazardType];
    throw new ConflictException(
      `An active ${duplicate.level} ${hazard} warning (${duplicate.reference}) already covers ${describeDistricts(duplicate.districts)}. Review it, or confirm to issue anyway.`,
    );
  }

  private async require(id: string): Promise<HazardWarningEntity> {
    const warning = await this.warnings.findById(id);
    if (!warning) throw new NotFoundException('Warning not found');
    return warning;
  }

  private expectUpdated(result: TransitionResult, conflict: string): HazardWarningEntity {
    if (result.outcome === 'NOT_FOUND') throw new NotFoundException('Warning not found');
    if (result.outcome === 'WRONG_STATE') throw new ConflictException(conflict);
    return result.warning;
  }
}
```

Note: the duplicate message names the *existing* warning's districts. In the test both are Colombo and Gampaha.

Run: `cd apps/api && bunx vitest run src/hazard-warnings/hazard-warnings.service.spec.ts`
Expected: PASS.

- [ ] **Step 3: Write failing query and alert tests**

`warning-queries.service.spec.ts`:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { decided, entity, fakeRepository as fakeReportRepository } from '../hazard-reports/testing/fixtures.js';
import {
  fakeDeliveries,
  fakeLogRepository,
  fakeWarningRepository,
  issuedWarning,
  NOW,
  REPORT_ID,
  WARNING_ID,
} from './testing/fixtures.js';
import { WarningQueriesService } from './warning-queries.service.js';

describe('WarningQueriesService', () => {
  let warnings: ReturnType<typeof fakeWarningRepository>;
  let logs: ReturnType<typeof fakeLogRepository>;
  let deliveries: ReturnType<typeof fakeDeliveries>;
  let reports: ReturnType<typeof fakeReportRepository>;
  let service: WarningQueriesService;

  beforeEach(() => {
    warnings = fakeWarningRepository();
    logs = fakeLogRepository();
    deliveries = fakeDeliveries();
    reports = fakeReportRepository();
    service = new WarningQueriesService(warnings, logs, deliveries, reports);
  });

  it('lists a view with paging', async () => {
    warnings.list.mockResolvedValue({ items: [], total: 0, page: 2, limit: 10 });
    await service.list('past', 2, 10, NOW);
    expect(warnings.list).toHaveBeenCalledWith({ view: 'past', page: 2, limit: 10, now: NOW });
  });

  it('counts issued today from midnight in Sri Lanka', async () => {
    warnings.stats.mockResolvedValue({ active: 1, drafts: 0, issuedToday: 1 });
    await service.stats(NOW);
    // 2026-10-07T08:00Z is 13:30 in Colombo; midnight there is 2026-10-06T18:30Z.
    expect(warnings.stats).toHaveBeenCalledWith(NOW, new Date('2026-10-06T18:30:00.000Z'));
  });

  it('returns a warning with its latest logs and acknowledgement count', async () => {
    warnings.findById.mockResolvedValue(issuedWarning());
    deliveries.countAcknowledged.mockResolvedValue(3);

    const detail = await service.findOne(WARNING_ID);

    expect(detail).toEqual({ warning: issuedWarning(), logs: [], acknowledged: 3 });
    expect(logs.listForWarning).toHaveBeenCalledWith(WARNING_ID, 50);
  });

  it('404s an unknown warning', async () => {
    warnings.findById.mockResolvedValue(null);
    await expect(service.findOne(WARNING_ID)).rejects.toThrow(new NotFoundException('Warning not found'));
  });

  describe('prefill', () => {
    it('builds the form from a verified report, choosing the nearest district', async () => {
      reports.findById.mockResolvedValue(decided('VERIFIED', { id: REPORT_ID }));

      await expect(service.prefill(REPORT_ID)).resolves.toEqual({
        hazardType: 'FLOOD',
        districts: ['KANDY'],
        description: 'Water is rising near the bridge',
        sourceReportId: REPORT_ID,
        reportReference: 'HR-2026-0001',
      });
    });

    it('refuses a report that is not verified', async () => {
      reports.findById.mockResolvedValue(entity());
      await expect(service.prefill(REPORT_ID)).rejects.toThrow(
        new BadRequestException('Only verified reports can be escalated to a warning.'),
      );
    });

    it('404s an unknown report', async () => {
      reports.findById.mockResolvedValue(null);
      await expect(service.prefill(REPORT_ID)).rejects.toThrow(new NotFoundException('Report not found'));
    });
  });
});
```

`citizen-alerts.service.spec.ts`:

```ts
import { ConflictException, NotFoundException } from '@nestjs/common';

import { CitizenAlertsService } from './citizen-alerts.service.js';
import {
  delivery,
  DEVICE_ID,
  fakeDeliveries,
  fakeWarningRepository,
  hoursFromNow,
  issuedWarning,
  NOW,
  OTHER_WARNING_ID,
  WARNING_ID,
} from './testing/fixtures.js';

describe('CitizenAlertsService', () => {
  let deliveries: ReturnType<typeof fakeDeliveries>;
  let warnings: ReturnType<typeof fakeWarningRepository>;
  let service: CitizenAlertsService;

  beforeEach(() => {
    deliveries = fakeDeliveries();
    warnings = fakeWarningRepository();
    service = new CitizenAlertsService(deliveries, warnings);
  });

  it('lists delivered warnings, active first, then recent all-clears, hiding old ones', async () => {
    const cleared = issuedWarning({
      id: OTHER_WARNING_ID,
      issuedAt: hoursFromNow(1),
      status: 'CANCELLED',
      cancellation: { cancelledAt: NOW, cancelledBy: 'Officer Silva', reason: 'Receded' },
    });
    const old = issuedWarning({ id: '6700aa77bcf86cd799439033', validUntil: hoursFromNow(-24 * 10) });
    deliveries.listForDevice.mockResolvedValue([
      delivery({ warningId: OTHER_WARNING_ID }),
      delivery({ warningId: WARNING_ID }),
      delivery({ warningId: old.id }),
    ]);
    warnings.findByIds.mockResolvedValue([cleared, issuedWarning(), old]);

    const alerts = await service.listMine(DEVICE_ID, NOW);

    expect(alerts.map((a) => [a.id, a.state])).toEqual([
      [WARNING_ID, 'ACTIVE'],
      [OTHER_WARNING_ID, 'ALL_CLEAR'],
    ]);
    expect(alerts[1]?.cancelReason).toBe('Receded');
    expect(deliveries.listForDevice).toHaveBeenCalledWith(DEVICE_ID, 50);
  });

  it('returns nothing for a device that never received a warning', async () => {
    await expect(service.listMine(DEVICE_ID, NOW)).resolves.toEqual([]);
    expect(warnings.findByIds).not.toHaveBeenCalled();
  });

  it('acknowledges an active warning delivered to the device', async () => {
    warnings.findById.mockResolvedValue(issuedWarning());
    deliveries.acknowledge.mockResolvedValue(delivery({ acknowledgedAt: NOW }));

    const alert = await service.acknowledge(WARNING_ID, DEVICE_ID, NOW);

    expect(alert.acknowledgedAt).toBe(NOW.toISOString());
    expect(deliveries.acknowledge).toHaveBeenCalledWith(WARNING_ID, DEVICE_ID, NOW);
  });

  it('404s a warning that was never delivered to this device', async () => {
    warnings.findById.mockResolvedValue(issuedWarning());
    deliveries.acknowledge.mockResolvedValue(null);
    await expect(service.acknowledge(WARNING_ID, DEVICE_ID, NOW)).rejects.toThrow(new NotFoundException('Alert not found'));
  });

  it('404s an unknown or draft warning', async () => {
    warnings.findById.mockResolvedValue(null);
    await expect(service.acknowledge(WARNING_ID, DEVICE_ID, NOW)).rejects.toThrow(NotFoundException);
  });

  it('refuses to acknowledge a warning that is no longer active', async () => {
    warnings.findById.mockResolvedValue(issuedWarning({ validUntil: hoursFromNow(-1) }));
    await expect(service.acknowledge(WARNING_ID, DEVICE_ID, NOW)).rejects.toThrow(
      new ConflictException('This warning is no longer active'),
    );
    expect(deliveries.acknowledge).not.toHaveBeenCalled();
  });
});
```

`apps/api/src/citizens/citizens.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';

import { citizen, DEVICE_ID, fakeDirectory } from '../hazard-warnings/testing/fixtures.js';
import { CitizensService } from './citizens.service.js';

describe('CitizensService', () => {
  it('registers the device in a district with an optional phone', async () => {
    const directory = fakeDirectory();
    directory.register.mockResolvedValue(citizen());

    await new CitizensService(directory).register(DEVICE_ID, { district: 'COLOMBO', phone: '+94771234567' });

    expect(directory.register).toHaveBeenCalledWith(DEVICE_ID, 'COLOMBO', '+94771234567');
  });

  it('returns the profile, or 404 when the district was never set', async () => {
    const directory = fakeDirectory();
    directory.findByDeviceId.mockResolvedValueOnce(citizen()).mockResolvedValueOnce(null);
    const service = new CitizensService(directory);

    await expect(service.profile(DEVICE_ID)).resolves.toEqual(citizen());
    await expect(service.profile(DEVICE_ID)).rejects.toThrow(
      new NotFoundException('Set your district to receive warnings'),
    );
  });
});
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings/warning-queries.service.spec.ts src/hazard-warnings/citizen-alerts.service.spec.ts src/citizens/citizens.service.spec.ts`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement the three services**

`warning-queries.service.ts`:

```ts
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  nearestDistrict,
  type Paginated,
  type WarningPrefill,
  type WarningStats,
  type WarningView,
} from '@repo/types';

import { ALERT_DELIVERY_REPOSITORY } from '../citizens/alert-delivery.repository.js';
import type { AlertDeliveryRepository } from '../citizens/alert-delivery.repository.js';
import { startOfColomboDay } from '../common/time.js';
import { HAZARD_REPORT_REPOSITORY } from '../hazard-reports/hazard-report.repository.js';
import type { HazardReportRepository } from '../hazard-reports/hazard-report.repository.js';
import type { HazardWarningEntity, NotificationLogEntity } from './domain/hazard-warning.entity.js';
import { HAZARD_WARNING_REPOSITORY } from './hazard-warning.repository.js';
import type { HazardWarningRepository } from './hazard-warning.repository.js';
import { NOTIFICATION_LOG_REPOSITORY } from './notification-log.repository.js';
import type { NotificationLogRepository } from './notification-log.repository.js';

const LOGS_SHOWN = 50;

export interface WarningDetail {
  warning: HazardWarningEntity;
  logs: NotificationLogEntity[];
  acknowledged: number;
}

/** Read side for the portal: lists, counts, the status page, and the prefill from a report. */
@Injectable()
export class WarningQueriesService {
  constructor(
    @Inject(HAZARD_WARNING_REPOSITORY) private readonly warnings: HazardWarningRepository,
    @Inject(NOTIFICATION_LOG_REPOSITORY) private readonly logs: NotificationLogRepository,
    @Inject(ALERT_DELIVERY_REPOSITORY) private readonly deliveries: AlertDeliveryRepository,
    @Inject(HAZARD_REPORT_REPOSITORY) private readonly reports: HazardReportRepository,
  ) {}

  list(view: WarningView, page: number, limit: number, now = new Date()): Promise<Paginated<HazardWarningEntity>> {
    return this.warnings.list({ view, page, limit, now });
  }

  stats(now = new Date()): Promise<WarningStats> {
    return this.warnings.stats(now, startOfColomboDay(now));
  }

  async findOne(id: string): Promise<WarningDetail> {
    const warning = await this.warnings.findById(id);
    if (!warning) throw new NotFoundException('Warning not found');
    const [logs, acknowledged] = await Promise.all([
      this.logs.listForWarning(id, LOGS_SHOWN),
      this.deliveries.countAcknowledged(id),
    ]);
    return { warning, logs, acknowledged };
  }

  /** Starts a warning from what a verified citizen report already says (finding UC2). */
  async prefill(reportId: string): Promise<WarningPrefill> {
    const report = await this.reports.findById(reportId);
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== 'VERIFIED') {
      throw new BadRequestException('Only verified reports can be escalated to a warning.');
    }
    return {
      hazardType: report.type,
      districts: [nearestDistrict(report.location)],
      description: report.description,
      sourceReportId: report.id,
      reportReference: report.reference,
    };
  }
}
```

`citizen-alerts.service.ts`:

```ts
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { CitizenAlertDto } from '@repo/types';

import { ALERT_DELIVERY_REPOSITORY } from '../citizens/alert-delivery.repository.js';
import type { AlertDeliveryRepository } from '../citizens/alert-delivery.repository.js';
import { toCitizenAlertDto } from './domain/hazard-warning.mapper.js';
import { citizenAlertState } from './domain/warning-rules.js';
import { HAZARD_WARNING_REPOSITORY } from './hazard-warning.repository.js';
import type { HazardWarningRepository } from './hazard-warning.repository.js';

const DELIVERIES_READ = 50;

/** The citizen side of a warning: what reached this phone, and acknowledging it. */
@Injectable()
export class CitizenAlertsService {
  constructor(
    @Inject(ALERT_DELIVERY_REPOSITORY) private readonly deliveries: AlertDeliveryRepository,
    @Inject(HAZARD_WARNING_REPOSITORY) private readonly warnings: HazardWarningRepository,
  ) {}

  /** Active warnings first, then recent All Clears and expiries, newest first within each. */
  async listMine(deviceId: string, now = new Date()): Promise<CitizenAlertDto[]> {
    const received = await this.deliveries.listForDevice(deviceId, DELIVERIES_READ);
    if (received.length === 0) return [];

    const warnings = await this.warnings.findByIds(received.map((item) => item.warningId));
    const byId = new Map(warnings.map((warning) => [warning.id, warning]));

    const alerts = received.flatMap((item) => {
      const warning = byId.get(item.warningId);
      const state = warning && citizenAlertState(warning, now);
      return warning && state ? [toCitizenAlertDto(warning, item, state)] : [];
    });

    return alerts.sort((a, b) => {
      const rank = Number(a.state !== 'ACTIVE') - Number(b.state !== 'ACTIVE');
      return rank !== 0 ? rank : b.issuedAt.localeCompare(a.issuedAt);
    });
  }

  async acknowledge(warningId: string, deviceId: string, now = new Date()): Promise<CitizenAlertDto> {
    const warning = await this.warnings.findById(warningId);
    const state = warning && citizenAlertState(warning, now);
    if (!warning || !state) throw new NotFoundException('Alert not found');
    if (state !== 'ACTIVE') throw new ConflictException('This warning is no longer active');

    const delivery = await this.deliveries.acknowledge(warningId, deviceId, now);
    if (!delivery) throw new NotFoundException('Alert not found');
    return toCitizenAlertDto(warning, delivery, state);
  }
}
```

`apps/api/src/citizens/citizens.service.ts`:

```ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { RegisterCitizenInput } from '@repo/types';

import type { CitizenEntity } from './citizen.entity.js';
import { CITIZEN_DIRECTORY } from './citizen-directory.js';
import type { CitizenDirectory } from './citizen-directory.js';

/** A citizen's alert area: the district warnings are targeted by (finding UI5). */
@Injectable()
export class CitizensService {
  constructor(@Inject(CITIZEN_DIRECTORY) private readonly directory: CitizenDirectory) {}

  register(deviceId: string, input: RegisterCitizenInput): Promise<CitizenEntity> {
    return this.directory.register(deviceId, input.district, input.phone);
  }

  async profile(deviceId: string): Promise<CitizenEntity> {
    const citizen = await this.directory.findByDeviceId(deviceId);
    if (!citizen) throw new NotFoundException('Set your district to receive warnings');
    return citizen;
  }
}
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings src/citizens && bun run check-types && bun run lint`
Expected: PASS. (The report fixture's location `7.2906, 80.6337` is Kandy's centre, so `nearestDistrict` returns `KANDY`.)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/hazard-warnings apps/api/src/citizens
git commit -m "feat(api): add warning lifecycle, query and citizen alert services"
```

---
### Task 7: HTTP layer: DTOs, controllers, modules, e2e

**Files:**
- Modify: `apps/api/src/common/transforms.ts` (+ `trimEachDroppingBlank`), `apps/api/src/common/auth/caller.ts` (+ `officerNameOf`), `apps/api/src/hazard-reports/hazard-reports.controller.ts` (use `officerNameOf`), `apps/api/src/app.module.ts`, `apps/api/vitest.config.ts`
- Create: `apps/api/src/hazard-warnings/dto/warning-fields.dto.ts`, `dto/create-warning.dto.ts`, `dto/warning-action.dtos.ts`, `dto/warning-dtos.spec.ts`
- Create: `apps/api/src/hazard-warnings/hazard-warnings.controller.ts`, `alerts.controller.ts`, `hazard-warnings.module.ts`, `testing/create-warnings-app.ts`, `hazard-warnings.controller.spec.ts`
- Create: `apps/api/src/citizens/citizen.mapper.ts`, `dto/register-citizen.dto.ts`, `citizens.controller.ts`, `citizens.module.ts`
- Create: `apps/api/test/hazard-warnings.e2e.spec.ts`

**Interfaces:**
- Consumes: all services (Task 6), `toHazardWarningDto`, `toHazardWarningDetailDto` (Task 3), `OfficerGuard`, `CallerResolver`, `CurrentCaller`, `ReporterId` (existing).
- Produces: the HTTP API from the spec's endpoint table, consumed by Tasks 9-14:

| Method and path | Body / query | Success |
|---|---|---|
| `POST /api/hazard-warnings/preview` | `WarningFields` | 200 `WarningPreview` |
| `POST /api/hazard-warnings` | `CreateWarningInput` | 201 `HazardWarningDto` (200 on replay) |
| `PATCH /api/hazard-warnings/:id` | `WarningFields` | 200 `HazardWarningDto` |
| `DELETE /api/hazard-warnings/:id` | | 204 |
| `POST /api/hazard-warnings/:id/issue` | `IssueWarningInput` | 200 `HazardWarningDto` |
| `POST /api/hazard-warnings/:id/retry` | | 200 `HazardWarningDto` |
| `POST /api/hazard-warnings/:id/cancel` | `CancelWarningInput` | 200 `HazardWarningDto` |
| `GET /api/hazard-warnings?view&page&limit` | | 200 `Paginated<HazardWarningDto>` |
| `GET /api/hazard-warnings/stats` | | 200 `WarningStats` |
| `GET /api/hazard-warnings/prefill?reportId=` | | 200 `WarningPrefill` |
| `GET /api/hazard-warnings/:id` | | 200 `HazardWarningDetailDto` |
| `PUT /api/citizens/me` | `RegisterCitizenInput` | 200 `CitizenProfileDto` |
| `GET /api/citizens/me` | | 200 `CitizenProfileDto` or 404 |
| `GET /api/alerts/mine` | | 200 `CitizenAlertDto[]` |
| `POST /api/alerts/:warningId/acknowledge` | | 200 `CitizenAlertDto` |

- [ ] **Step 1: Shared helpers**

Append to `apps/api/src/common/transforms.ts`:

```ts
/** Trims each string in a list and drops the blank ones (empty form rows). */
export function trimEachDroppingBlank({ value }: { value: unknown }): unknown {
  if (!Array.isArray(value)) return value;
  return value
    .map((item: unknown) => (typeof item === 'string' ? item.trim() : item))
    .filter((item: unknown) => item !== '');
}
```

Append to `apps/api/src/common/auth/caller.ts`:

```ts
/** OfficerGuard guarantees an officer; this narrows the type for the compiler. */
export function officerNameOf(caller: Caller): string {
  if (caller.kind !== 'officer') {
    throw new Error('Officer route reached by a non-officer');
  }
  return caller.name;
}
```

In `hazard-reports.controller.ts`, delete the local `officerName` function, import `officerNameOf` from `../common/auth/caller.js` (merge with the existing `type Caller` import), and replace the two `officerName(caller)` calls with `officerNameOf(caller)`.

- [ ] **Step 2: Write failing DTO tests** — `apps/api/src/hazard-warnings/dto/warning-dtos.spec.ts` (same `plainToInstance` + `validate` style as `hazard-reports/dto/officer-dtos.spec.ts`; open that file and copy its `errorsFor` helper)

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterCitizenDto } from '../../citizens/dto/register-citizen.dto.js';
import { CLIENT_REQUEST_ID } from '../testing/fixtures.js';
import { CreateWarningDto } from './create-warning.dto.js';
import { CancelWarningDto, ListWarningsQueryDto } from './warning-action.dtos.js';

async function errorsFor<T extends object>(type: new () => T, body: object) {
  const errors = await validate(plainToInstance(type, body), { stopAtFirstError: true });
  return Object.fromEntries(errors.map((e) => [e.property, Object.values(e.constraints ?? {})[0]]));
}

const valid = {
  clientRequestId: CLIENT_REQUEST_ID,
  action: 'ISSUE',
  hazardType: 'FLOOD',
  level: 'HIGH',
  districts: ['COLOMBO'],
  description: 'Heavy rainfall expected in low-lying areas',
  safetyInstructions: ['  Move to higher ground ', ''],
  validUntil: '2026-10-07T20:00:00.000Z',
};

describe('CreateWarningDto', () => {
  it('accepts a complete warning and tidies the instruction rows', async () => {
    expect(await errorsFor(CreateWarningDto, valid)).toEqual({});
    expect(plainToInstance(CreateWarningDto, valid).safetyInstructions).toEqual(['Move to higher ground']);
  });

  it.each([
    ['districts', { districts: [] }, 'select at least one affected district'],
    ['districts', { districts: ['Colombo'] }, undefined],
    ['districts', { districts: ['COLOMBO', 'COLOMBO'] }, undefined],
    ['level', { level: 'SEVERE' }, undefined],
    ['action', { action: 'SEND' }, undefined],
    ['description', { description: 'short' }, undefined],
    ['validUntil', { validUntil: 'tomorrow' }, undefined],
    ['sourceReportId', { sourceReportId: '123' }, undefined],
    ['safetyInstructions', { safetyInstructions: Array(9).fill('Stay indoors') }, undefined],
  ])('rejects a bad %s', async (field, change, message) => {
    const errors = await errorsFor(CreateWarningDto, { ...valid, ...change });
    expect(errors).toHaveProperty(field);
    if (message) expect(errors[field]).toBe(message);
  });

  it('lets a draft leave the description and period out', async () => {
    const { description: _d, validUntil: _v, safetyInstructions: _s, ...draft } = valid;
    expect(await errorsFor(CreateWarningDto, { ...draft, action: 'DRAFT' })).toEqual({});
  });
});

describe('CancelWarningDto', () => {
  it('needs a reason of 5 to 300 characters', async () => {
    expect(await errorsFor(CancelWarningDto, { reason: 'Water receded' })).toEqual({});
    expect(await errorsFor(CancelWarningDto, { reason: ' no ' })).toHaveProperty('reason');
    expect(await errorsFor(CancelWarningDto, {})).toHaveProperty('reason');
  });
});

describe('ListWarningsQueryDto', () => {
  it('defaults to the first page of active warnings', () => {
    const query = plainToInstance(ListWarningsQueryDto, {});
    expect(query).toMatchObject({ view: 'active', page: 1, limit: 20 });
  });

  it('rejects an unknown view and an oversized page', async () => {
    expect(await errorsFor(ListWarningsQueryDto, { view: 'all' })).toHaveProperty('view');
    expect(await errorsFor(ListWarningsQueryDto, { limit: '51' })).toHaveProperty('limit');
  });
});

describe('RegisterCitizenDto', () => {
  it('normalises a Sri Lankan mobile number', async () => {
    const dto = plainToInstance(RegisterCitizenDto, { district: 'KANDY', phone: '077 123 4567' });
    expect(dto.phone).toBe('+94771234567');
    expect(await errorsFor(RegisterCitizenDto, { district: 'KANDY', phone: '077 123 4567' })).toEqual({});
  });

  it('treats a blank phone as none and rejects a bad one', async () => {
    expect(plainToInstance(RegisterCitizenDto, { district: 'KANDY', phone: '  ' }).phone).toBeUndefined();
    expect(await errorsFor(RegisterCitizenDto, { district: 'KANDY', phone: '12345' })).toEqual({
      phone: 'phone must be a Sri Lankan mobile number, such as 077 123 4567',
    });
  });

  it('needs a known district', async () => {
    expect(await errorsFor(RegisterCitizenDto, { district: 'ATLANTIS' })).toHaveProperty('district');
  });
});
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings/dto`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the DTOs**

`dto/warning-fields.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import {
  DISTRICTS,
  HAZARD_TYPES,
  WARNING_LEVELS,
  WARNING_LIMITS,
  type District,
  type HazardType,
  type WarningFields,
  type WarningLevel,
} from '@repo/types';

import { trimEachDroppingBlank, trimToUndefined } from '../../common/transforms.js';

const L = WARNING_LIMITS;

/**
 * What the officer fills in. Only type, level and districts are required here
 * so a draft can be saved half-done; the service checks the rest before issue.
 * Decorators run bottom-up and only the first failure per field is kept, so
 * the most basic check sits next to the property.
 */
export class WarningFieldsDto implements WarningFields {
  @ApiProperty({ enum: HAZARD_TYPES })
  @IsIn(HAZARD_TYPES)
  hazardType: HazardType;

  @ApiProperty({ enum: WARNING_LEVELS })
  @IsIn(WARNING_LEVELS)
  level: WarningLevel;

  @ApiProperty({ enum: DISTRICTS, isArray: true })
  @IsIn(DISTRICTS, { each: true })
  @ArrayUnique()
  @ArrayMaxSize(L.districtsMax)
  @ArrayMinSize(1, { message: 'select at least one affected district' })
  @IsArray()
  districts: District[];

  @ApiPropertyOptional({ minLength: L.descriptionMin, maxLength: L.descriptionMax })
  @IsOptional()
  @Length(L.descriptionMin, L.descriptionMax)
  @IsString()
  @Transform(trimToUndefined)
  description?: string;

  @ApiPropertyOptional({ maxLength: L.additionalInfoMax })
  @IsOptional()
  @MaxLength(L.additionalInfoMax)
  @IsString()
  @Transform(trimToUndefined)
  additionalInfo?: string;

  @ApiPropertyOptional({ type: [String], maxItems: L.instructionsMax })
  @IsOptional()
  @Length(L.instructionMin, L.instructionMax, { each: true })
  @IsString({ each: true })
  @ArrayMaxSize(L.instructionsMax)
  @IsArray()
  @Transform(trimEachDroppingBlank)
  safetyInstructions?: string[];

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  validFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  validUntil?: string;

  @ApiPropertyOptional({ description: 'Verified hazard report this warning was started from' })
  @IsOptional()
  @IsMongoId()
  sourceReportId?: string;
}
```

`dto/create-warning.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

import type { CreateWarningInput } from '@repo/types';

import { WarningFieldsDto } from './warning-fields.dto.js';

const ACTIONS = ['DRAFT', 'ISSUE'] as const;

export class CreateWarningDto extends WarningFieldsDto implements CreateWarningInput {
  @ApiProperty({ description: 'Generated per form; a repeated request returns the first warning' })
  @IsUUID()
  clientRequestId: string;

  @ApiProperty({ enum: ACTIONS })
  @IsIn(ACTIONS)
  action: CreateWarningInput['action'];

  @ApiPropertyOptional({ description: 'Issue even if an active warning already covers this hazard and area' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
```

`dto/warning-action.dtos.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsMongoId, IsOptional, IsString, Length, Max, Min } from 'class-validator';

import {
  WARNING_LIMITS,
  type CancelWarningInput,
  type IssueWarningInput,
  type ListWarningsQuery,
  type WarningView,
} from '@repo/types';

import { trim } from '../../common/transforms.js';

const VIEWS = ['active', 'drafts', 'past'] as const;
export const DEFAULT_PAGE_SIZE = 20;

export class IssueWarningDto implements IssueWarningInput {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class CancelWarningDto implements CancelWarningInput {
  @ApiProperty({ minLength: WARNING_LIMITS.cancelReasonMin, maxLength: WARNING_LIMITS.cancelReasonMax })
  @Length(WARNING_LIMITS.cancelReasonMin, WARNING_LIMITS.cancelReasonMax)
  @IsString()
  @Transform(trim)
  reason: string;
}

export class ListWarningsQueryDto implements ListWarningsQuery {
  @ApiPropertyOptional({ enum: VIEWS, default: 'active' })
  @IsIn(VIEWS)
  view: WarningView = 'active';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: WARNING_LIMITS.pageSizeMax, default: DEFAULT_PAGE_SIZE })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(WARNING_LIMITS.pageSizeMax)
  limit = DEFAULT_PAGE_SIZE;
}

export class PrefillQueryDto {
  @ApiProperty()
  @IsMongoId()
  reportId: string;
}
```

`apps/api/src/citizens/dto/register-citizen.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, Matches } from 'class-validator';

import {
  DISTRICTS,
  normalizeSriLankanMobile,
  type District,
  type RegisterCitizenInput,
} from '@repo/types';

/** Blank means no phone; anything recognisable becomes +947XXXXXXXX. */
function toMobile({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return normalizeSriLankanMobile(value) ?? value;
}

export class RegisterCitizenDto implements RegisterCitizenInput {
  @ApiProperty({ enum: DISTRICTS })
  @IsIn(DISTRICTS)
  district: District;

  @ApiPropertyOptional({ example: '077 123 4567', description: 'For SMS warnings' })
  @IsOptional()
  @Matches(/^\+947\d{8}$/, { message: 'phone must be a Sri Lankan mobile number, such as 077 123 4567' })
  @Transform(toMobile)
  phone?: string;
}
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings/dto`
Expected: PASS. If `@Transform` placement relative to validators changes the behaviour, keep `@Transform` directly above the property (as above); class-transformer runs it before validation regardless of order.

- [ ] **Step 4: Controllers**

`apps/api/src/citizens/citizen.mapper.ts`:

```ts
import type { CitizenProfileDto } from '@repo/types';

import type { CitizenEntity } from './citizen.entity.js';

export function toCitizenProfileDto(citizen: CitizenEntity): CitizenProfileDto {
  return {
    district: citizen.district,
    phone: citizen.phone,
    updatedAt: citizen.updatedAt.toISOString(),
  };
}
```

(It lives in the citizens module so that module never imports from `hazard-warnings`. The dependency only runs the other way.)

`apps/api/src/citizens/citizens.controller.ts`:

```ts
import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import type { CitizenProfileDto } from '@repo/types';

import { ReporterId } from '../common/decorators/reporter-id.decorator.js';
import { toCitizenProfileDto } from './citizen.mapper.js';
import { CitizensService } from './citizens.service.js';
import { RegisterCitizenDto } from './dto/register-citizen.dto.js';

@ApiTags('citizens')
@ApiSecurity('reporter-id')
@Controller('citizens')
export class CitizensController {
  constructor(private readonly service: CitizensService) {}

  @Put('me')
  @ApiOperation({ summary: "Set the caller's alert district and optional SMS number" })
  async register(@ReporterId() deviceId: string, @Body() dto: RegisterCitizenDto): Promise<CitizenProfileDto> {
    return toCitizenProfileDto(await this.service.register(deviceId, dto));
  }

  @Get('me')
  @ApiOperation({ summary: "The caller's alert district (404 until set)" })
  async profile(@ReporterId() deviceId: string): Promise<CitizenProfileDto> {
    return toCitizenProfileDto(await this.service.profile(deviceId));
  }
}
```

`apps/api/src/hazard-warnings/alerts.controller.ts`:

```ts
import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import type { CitizenAlertDto } from '@repo/types';

import { ReporterId } from '../common/decorators/reporter-id.decorator.js';
import { CitizenAlertsService } from './citizen-alerts.service.js';

@ApiTags('alerts')
@ApiSecurity('reporter-id')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: CitizenAlertsService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Warnings delivered to this device: active first, then recent All Clears' })
  listMine(@ReporterId() deviceId: string): Promise<CitizenAlertDto[]> {
    return this.service.listMine(deviceId);
  }

  @Post(':warningId/acknowledge')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark an active warning as acknowledged (idempotent)' })
  acknowledge(@ReporterId() deviceId: string, @Param('warningId') warningId: string): Promise<CitizenAlertDto> {
    return this.service.acknowledge(warningId, deviceId);
  }
}
```

`apps/api/src/hazard-warnings/hazard-warnings.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import type {
  HazardWarningDetailDto,
  HazardWarningDto,
  Paginated,
  WarningPrefill,
  WarningPreview,
  WarningStats,
} from '@repo/types';

import { officerNameOf, type Caller } from '../common/auth/caller.js';
import { CurrentCaller } from '../common/auth/current-caller.decorator.js';
import { OfficerGuard } from '../common/auth/officer.guard.js';
import { toHazardWarningDetailDto, toHazardWarningDto } from './domain/hazard-warning.mapper.js';
import { CreateWarningDto } from './dto/create-warning.dto.js';
import { CancelWarningDto, IssueWarningDto, ListWarningsQueryDto, PrefillQueryDto } from './dto/warning-action.dtos.js';
import { WarningFieldsDto } from './dto/warning-fields.dto.js';
import { HazardWarningsService } from './hazard-warnings.service.js';
import { WarningQueriesService } from './warning-queries.service.js';

/** Officer routes. Static paths come before `:id` so the parameter never swallows them. */
@ApiTags('hazard-warnings')
@ApiSecurity('officer-key')
@UseGuards(OfficerGuard)
@Controller('hazard-warnings')
export class HazardWarningsController {
  constructor(
    private readonly commands: HazardWarningsService,
    private readonly queries: WarningQueriesService,
  ) {}

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Validate, count recipients and find duplicates. Stores nothing.' })
  async preview(@Body() dto: WarningFieldsDto): Promise<WarningPreview> {
    const now = new Date();
    const { recipients, duplicates } = await this.commands.preview(dto, now);
    return { recipients, duplicates: duplicates.map((warning) => toHazardWarningDto(warning, now)) };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Active, drafts, issued today' })
  stats(): Promise<WarningStats> {
    return this.queries.stats();
  }

  @Get('prefill')
  @ApiOperation({ summary: 'Form values from a VERIFIED hazard report' })
  prefill(@Query() query: PrefillQueryDto): Promise<WarningPrefill> {
    return this.queries.prefill(query.reportId);
  }

  @Get()
  @ApiOperation({ summary: 'Active, draft or past warnings, newest first' })
  async list(@Query() query: ListWarningsQueryDto): Promise<Paginated<HazardWarningDto>> {
    const now = new Date();
    const page = await this.queries.list(query.view, query.page, query.limit, now);
    return { ...page, items: page.items.map((warning) => toHazardWarningDto(warning, now)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'One warning with channel status and delivery activity' })
  async findOne(@Param('id') id: string): Promise<HazardWarningDetailDto> {
    const { warning, logs, acknowledged } = await this.queries.findOne(id);
    return toHazardWarningDetailDto(warning, logs, acknowledged, new Date());
  }

  @Post()
  @ApiOperation({ summary: 'Save a draft or issue now (201, or 200 for a replay)' })
  async create(
    @Body() dto: CreateWarningDto,
    @CurrentCaller() caller: Caller,
    @Res({ passthrough: true }) response: Response,
  ): Promise<HazardWarningDto> {
    const { warning, created } = await this.commands.create(dto, officerNameOf(caller));
    response.status(created ? 201 : 200);
    return toHazardWarningDto(warning, new Date());
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a draft (409 if it was issued)' })
  async update(@Param('id') id: string, @Body() dto: WarningFieldsDto): Promise<HazardWarningDto> {
    return toHazardWarningDto(await this.commands.updateDraft(id, dto), new Date());
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a draft' })
  remove(@Param('id') id: string): Promise<void> {
    return this.commands.deleteDraft(id);
  }

  @Post(':id/issue')
  @HttpCode(200)
  @ApiOperation({ summary: 'Issue a draft and send it' })
  async issue(
    @Param('id') id: string,
    @Body() dto: IssueWarningDto,
    @CurrentCaller() caller: Caller,
  ): Promise<HazardWarningDto> {
    const warning = await this.commands.issue(id, officerNameOf(caller), dto.force ?? false);
    return toHazardWarningDto(warning, new Date());
  }

  @Post(':id/retry')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send again on the channels that failed' })
  async retry(@Param('id') id: string): Promise<HazardWarningDto> {
    return toHazardWarningDto(await this.commands.retry(id), new Date());
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel an issued warning and send an All Clear' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelWarningDto,
    @CurrentCaller() caller: Caller,
  ): Promise<HazardWarningDto> {
    const warning = await this.commands.cancel(id, officerNameOf(caller), dto.reason);
    return toHazardWarningDto(warning, new Date());
  }
}
```

- [ ] **Step 5: Modules and app wiring**

`apps/api/src/citizens/citizens.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { ALERT_DELIVERY_REPOSITORY } from './alert-delivery.repository.js';
import { CITIZEN_DIRECTORY } from './citizen-directory.js';
import { CitizensController } from './citizens.controller.js';
import { CitizensService } from './citizens.service.js';
import { PrismaAlertDeliveryRepository } from './infrastructure/prisma-alert-delivery.repository.js';
import { PrismaCitizenDirectory } from './infrastructure/prisma-citizen-directory.js';

@Module({
  controllers: [CitizensController],
  providers: [
    CitizensService,
    { provide: CITIZEN_DIRECTORY, useClass: PrismaCitizenDirectory },
    { provide: ALERT_DELIVERY_REPOSITORY, useClass: PrismaAlertDeliveryRepository },
  ],
  exports: [CITIZEN_DIRECTORY, ALERT_DELIVERY_REPOSITORY],
})
export class CitizensModule {}
```

`apps/api/src/hazard-warnings/hazard-warnings.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { CitizensModule } from '../citizens/citizens.module.js';
import { CallerResolver } from '../common/auth/caller.resolver.js';
import { OfficerGuard } from '../common/auth/officer.guard.js';
import { HazardReportsModule } from '../hazard-reports/hazard-reports.module.js';
import { AlertsController } from './alerts.controller.js';
import { CitizenAlertsService } from './citizen-alerts.service.js';
import { AudibleAlertChannel } from './dissemination/audible-alert.channel.js';
import { ChannelFailureSwitch } from './dissemination/channel-failure-switch.js';
import { InAppPushChannel } from './dissemination/in-app-push.channel.js';
import { NOTIFICATION_CHANNELS } from './dissemination/notification-channel.js';
import type { NotificationChannel } from './dissemination/notification-channel.js';
import { SmsChannel } from './dissemination/sms.channel.js';
import { WarningDisseminator } from './dissemination/warning-disseminator.js';
import { HAZARD_WARNING_REPOSITORY } from './hazard-warning.repository.js';
import { HazardWarningsController } from './hazard-warnings.controller.js';
import { HazardWarningsService } from './hazard-warnings.service.js';
import { PrismaHazardWarningRepository } from './infrastructure/prisma-hazard-warning.repository.js';
import { PrismaNotificationLogRepository } from './infrastructure/prisma-notification-log.repository.js';
import { NOTIFICATION_LOG_REPOSITORY } from './notification-log.repository.js';
import { WarningQueriesService } from './warning-queries.service.js';

@Module({
  imports: [CitizensModule, HazardReportsModule],
  controllers: [HazardWarningsController, AlertsController],
  providers: [
    HazardWarningsService,
    WarningQueriesService,
    CitizenAlertsService,
    WarningDisseminator,
    ChannelFailureSwitch,
    InAppPushChannel,
    SmsChannel,
    AudibleAlertChannel,
    // The order here is the order channels are sent and shown.
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (...channels: NotificationChannel[]) => channels,
      inject: [InAppPushChannel, SmsChannel, AudibleAlertChannel],
    },
    CallerResolver,
    OfficerGuard,
    { provide: HAZARD_WARNING_REPOSITORY, useClass: PrismaHazardWarningRepository },
    { provide: NOTIFICATION_LOG_REPOSITORY, useClass: PrismaNotificationLogRepository },
  ],
})
export class HazardWarningsModule {}
```

In `apps/api/src/app.module.ts` add `CitizensModule` and `HazardWarningsModule` to `imports` (after `NotificationsModule`). In `apps/api/vitest.config.ts` add to `thresholds`:

```ts
        'src/hazard-warnings/**': MINIMUM,
        'src/citizens/**': MINIMUM,
```

Run: `cd apps/api && bun run check-types && bun run lint`
Expected: PASS.

- [ ] **Step 6: Test app over fakes** — `apps/api/src/hazard-warnings/testing/create-warnings-app.ts`

```ts
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { configureApp } from '../../app.setup.js';
import { ALERT_DELIVERY_REPOSITORY } from '../../citizens/alert-delivery.repository.js';
import { CITIZEN_DIRECTORY } from '../../citizens/citizen-directory.js';
import { CitizensController } from '../../citizens/citizens.controller.js';
import { CitizensService } from '../../citizens/citizens.service.js';
import { CallerResolver } from '../../common/auth/caller.resolver.js';
import { OfficerGuard } from '../../common/auth/officer.guard.js';
import { HAZARD_REPORT_REPOSITORY } from '../../hazard-reports/hazard-report.repository.js';
import { fakeRepository as fakeReportRepository, OFFICER_KEY } from '../../hazard-reports/testing/fixtures.js';
import { AlertsController } from '../alerts.controller.js';
import { CitizenAlertsService } from '../citizen-alerts.service.js';
import { AudibleAlertChannel } from '../dissemination/audible-alert.channel.js';
import { ChannelFailureSwitch } from '../dissemination/channel-failure-switch.js';
import { InAppPushChannel } from '../dissemination/in-app-push.channel.js';
import { NOTIFICATION_CHANNELS, type NotificationChannel } from '../dissemination/notification-channel.js';
import { SmsChannel } from '../dissemination/sms.channel.js';
import { WarningDisseminator } from '../dissemination/warning-disseminator.js';
import { HAZARD_WARNING_REPOSITORY } from '../hazard-warning.repository.js';
import { HazardWarningsController } from '../hazard-warnings.controller.js';
import { HazardWarningsService } from '../hazard-warnings.service.js';
import { NOTIFICATION_LOG_REPOSITORY } from '../notification-log.repository.js';
import { WarningQueriesService } from '../warning-queries.service.js';
import { fakeDeliveries, fakeDirectory, fakeLogRepository, fakeWarningRepository } from './fixtures.js';

export interface WarningsTestApp {
  app: INestApplication;
  warnings: ReturnType<typeof fakeWarningRepository>;
  directory: ReturnType<typeof fakeDirectory>;
  deliveries: ReturnType<typeof fakeDeliveries>;
  logs: ReturnType<typeof fakeLogRepository>;
  reports: ReturnType<typeof fakeReportRepository>;
}

/** Real controllers, services, channels, guards and pipeline over fake storage. */
export async function createWarningsApp(failingChannels: string[] = []): Promise<WarningsTestApp> {
  const warnings = fakeWarningRepository();
  const directory = fakeDirectory();
  const deliveries = fakeDeliveries();
  const logs = fakeLogRepository();
  const reports = fakeReportRepository();
  const config = {
    get: (key: string) => (key === 'SIMULATE_CHANNEL_FAILURE' ? failingChannels : OFFICER_KEY),
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [HazardWarningsController, AlertsController, CitizensController],
    providers: [
      HazardWarningsService,
      WarningQueriesService,
      CitizenAlertsService,
      CitizensService,
      WarningDisseminator,
      ChannelFailureSwitch,
      InAppPushChannel,
      SmsChannel,
      AudibleAlertChannel,
      {
        provide: NOTIFICATION_CHANNELS,
        useFactory: (...channels: NotificationChannel[]) => channels,
        inject: [InAppPushChannel, SmsChannel, AudibleAlertChannel],
      },
      CallerResolver,
      OfficerGuard,
      { provide: ConfigService, useValue: config },
      { provide: HAZARD_WARNING_REPOSITORY, useValue: warnings },
      { provide: NOTIFICATION_LOG_REPOSITORY, useValue: logs },
      { provide: CITIZEN_DIRECTORY, useValue: directory },
      { provide: ALERT_DELIVERY_REPOSITORY, useValue: deliveries },
      { provide: HAZARD_REPORT_REPOSITORY, useValue: reports },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, warnings, directory, deliveries, logs, reports };
}
```

- [ ] **Step 7: Write the controller tests** — `apps/api/src/hazard-warnings/hazard-warnings.controller.spec.ts`

```ts
import { Logger, type INestApplication } from '@nestjs/common';
import request from 'supertest';

import { decided, OFFICER_KEY } from '../hazard-reports/testing/fixtures.js';
import { createWarningsApp, type WarningsTestApp } from './testing/create-warnings-app.js';
import {
  channel,
  citizen,
  CLIENT_REQUEST_ID,
  delivery,
  DEVICE_ID,
  issuedWarning,
  REPORT_ID,
  WARNING_ID,
  warningEntity,
} from './testing/fixtures.js';

const officer = { 'x-officer-key': OFFICER_KEY, 'x-officer-name': 'Officer Silva' };
const citizenHeaders = { 'x-reporter-id': DEVICE_ID };
const future = () => new Date(Date.now() + 12 * 3600_000).toISOString();

function fieldsBody(overrides: Record<string, unknown> = {}) {
  return {
    hazardType: 'FLOOD',
    level: 'HIGH',
    districts: ['COLOMBO'],
    description: 'Heavy rainfall expected in low-lying areas',
    safetyInstructions: ['Move to higher ground immediately'],
    validUntil: future(),
    ...overrides,
  };
}

function issueBody(overrides: Record<string, unknown> = {}) {
  return { ...fieldsBody(), clientRequestId: CLIENT_REQUEST_ID, action: 'ISSUE', ...overrides };
}

describe('hazard warning HTTP API', () => {
  let app: INestApplication;
  let t: WarningsTestApp;
  const http = () => request(app.getHttpServer());

  async function start(failing: string[] = []) {
    t = await createWarningsApp(failing);
    app = t.app;
    t.warnings.findByClientRequestId.mockResolvedValue(null);
    t.warnings.findActiveOverlapping.mockResolvedValue([]);
    t.warnings.create.mockImplementation(async (input) => ({
      warning: warningEntity({ ...input, validUntil: input.validUntil }),
      created: true,
    }));
    t.warnings.recordDissemination.mockImplementation(async (_id, channels, status) =>
      issuedWarning({ channels, status, validUntil: new Date(future()) }),
    );
    t.directory.findInDistricts.mockResolvedValue([{ deviceId: DEVICE_ID, district: 'COLOMBO', phone: '+94771234567' }]);
  }

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await start();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('access control', () => {
    it.each([
      ['get', '/api/hazard-warnings'],
      ['get', '/api/hazard-warnings/stats'],
      ['post', '/api/hazard-warnings'],
      ['post', `/api/hazard-warnings/${WARNING_ID}/cancel`],
    ] as const)('%s %s needs the officer key', async (method, path) => {
      expect((await http()[method](path).send({})).status).toBe(401);
      expect((await http()[method](path).set(citizenHeaders).send({})).status).toBe(401);
    });

    it('citizen routes need a device id', async () => {
      expect((await http().get('/api/alerts/mine')).status).toBe(400);
      expect((await http().put('/api/citizens/me').send({ district: 'KANDY' })).status).toBe(400);
    });
  });

  describe('POST /api/hazard-warnings', () => {
    it('issues, sends on every channel and returns 201 with the status', async () => {
      const response = await http().post('/api/hazard-warnings').set(officer).send(issueBody());

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ status: 'DISSEMINATED', active: true });
      expect(response.body.channels.map((c: { state: string }) => c.state)).toEqual(['SENT', 'SENT', 'SENT']);
      expect(t.deliveries.recordDelivered).toHaveBeenCalledWith(WARNING_ID, [DEVICE_ID]);
      expect(t.logs.record).toHaveBeenCalledTimes(3);
    });

    it('records PARTIALLY_DISSEMINATED when the SMS gateway is down', async () => {
      await app.close();
      await start(['SMS']);

      const response = await http().post('/api/hazard-warnings').set(officer).send(issueBody());

      expect(response.body.status).toBe('PARTIALLY_DISSEMINATED');
      expect(response.body.channels[1]).toMatchObject({ channel: 'SMS', state: 'FAILED', lastError: 'SMS gateway is unavailable' });
    });

    it('returns 200 with the first warning for a replay', async () => {
      t.warnings.findByClientRequestId.mockResolvedValue(issuedWarning());

      const response = await http().post('/api/hazard-warnings').set(officer).send(issueBody());

      expect(response.status).toBe(200);
      expect(t.warnings.create).not.toHaveBeenCalled();
    });

    it('returns 409 for a duplicate active warning, and 201 when forced', async () => {
      t.warnings.findActiveOverlapping.mockResolvedValue([issuedWarning({ reference: 'HW-2026-0009' })]);

      const refused = await http().post('/api/hazard-warnings').set(officer).send(issueBody());
      expect(refused.status).toBe(409);
      expect(refused.body.message).toContain('HW-2026-0009');

      const forced = await http().post('/api/hazard-warnings').set(officer).send(issueBody({ force: true }));
      expect(forced.status).toBe(201);
    });

    it('returns 400 with every missing detail for an incomplete issue', async () => {
      const response = await http()
        .post('/api/hazard-warnings')
        .set(officer)
        .send(issueBody({ description: undefined, safetyInstructions: [] }));

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('description is required to issue a warning; add at least one safety instruction');
    });

    it('rejects unknown fields', async () => {
      const response = await http().post('/api/hazard-warnings').set(officer).send(issueBody({ priority: 1 }));
      expect(response.status).toBe(400);
    });
  });

  it('previews the recipients and duplicates without storing anything', async () => {
    t.directory.countInDistricts.mockResolvedValue({ total: 0, withPhone: 0, byDistrict: { COLOMBO: 0 } });

    const response = await http().post('/api/hazard-warnings/preview').set(officer).send(fieldsBody());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ recipients: { total: 0, withPhone: 0, byDistrict: { COLOMBO: 0 } }, duplicates: [] });
    expect(t.warnings.create).not.toHaveBeenCalled();
  });

  it('lists, counts and shows warnings', async () => {
    t.warnings.list.mockResolvedValue({ items: [issuedWarning()], total: 1, page: 1, limit: 20 });
    t.warnings.stats.mockResolvedValue({ active: 1, drafts: 2, issuedToday: 1 });
    t.warnings.findById.mockResolvedValue(issuedWarning());

    expect((await http().get('/api/hazard-warnings?view=drafts').set(officer)).body.total).toBe(1);
    expect(t.warnings.list).toHaveBeenCalledWith(expect.objectContaining({ view: 'drafts', page: 1, limit: 20 }));
    expect((await http().get('/api/hazard-warnings/stats').set(officer)).body).toEqual({ active: 1, drafts: 2, issuedToday: 1 });
    expect((await http().get(`/api/hazard-warnings/${WARNING_ID}`).set(officer)).body).toMatchObject({ logs: [], acknowledged: 0 });
  });

  it('edits and deletes drafts', async () => {
    t.warnings.updateDraft.mockResolvedValue({ outcome: 'UPDATED', warning: warningEntity() });
    t.warnings.deleteDraft.mockResolvedValue('DELETED');
    expect((await http().patch(`/api/hazard-warnings/${WARNING_ID}`).set(officer).send(fieldsBody())).status).toBe(200);
    expect((await http().delete(`/api/hazard-warnings/${WARNING_ID}`).set(officer)).status).toBe(204);
  });

  it('issues a draft, retries failed channels, and cancels', async () => {
    t.warnings.findById.mockResolvedValueOnce(warningEntity({ validUntil: new Date(future()) }));
    t.warnings.startDissemination.mockResolvedValue({ outcome: 'UPDATED', warning: warningEntity({ status: 'DISSEMINATING' }) });
    expect((await http().post(`/api/hazard-warnings/${WARNING_ID}/issue`).set(officer).send({})).status).toBe(200);

    t.warnings.findById.mockResolvedValueOnce(
      issuedWarning({ status: 'PARTIALLY_DISSEMINATED', channels: [channel('PUSH'), channel('SMS', { state: 'FAILED' }), channel('AUDIBLE')] }),
    );
    const retried = await http().post(`/api/hazard-warnings/${WARNING_ID}/retry`).set(officer);
    expect(retried.status).toBe(200);
    expect(retried.body.status).toBe('DISSEMINATED');

    t.warnings.cancel.mockResolvedValue({ outcome: 'UPDATED', warning: issuedWarning({ status: 'CANCELLED' }) });
    const cancelled = await http().post(`/api/hazard-warnings/${WARNING_ID}/cancel`).set(officer).send({ reason: 'Water receded' });
    expect(cancelled.status).toBe(200);
    expect(t.logs.record).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ALL_CLEAR' }));
  });

  it('rejects a cancel without a reason', async () => {
    const response = await http().post(`/api/hazard-warnings/${WARNING_ID}/cancel`).set(officer).send({ reason: '' });
    expect(response.status).toBe(400);
    expect(t.warnings.cancel).not.toHaveBeenCalled();
  });

  it('prefills from a verified report and refuses a pending one', async () => {
    t.reports.findById.mockResolvedValueOnce(decided('VERIFIED', { id: REPORT_ID }));
    const ok = await http().get(`/api/hazard-warnings/prefill?reportId=${REPORT_ID}`).set(officer);
    expect(ok.body).toMatchObject({ districts: ['KANDY'], reportReference: 'HR-2026-0001' });

    t.reports.findById.mockResolvedValueOnce(decided('REJECTED'));
    const refused = await http().get(`/api/hazard-warnings/prefill?reportId=${REPORT_ID}`).set(officer);
    expect(refused.status).toBe(400);
    expect(refused.body.message).toBe('Only verified reports can be escalated to a warning.');
  });

  describe('citizen routes', () => {
    it('registers a district with a normalised phone, and reads it back', async () => {
      t.directory.register.mockResolvedValue(citizen());
      t.directory.findByDeviceId.mockResolvedValueOnce(citizen()).mockResolvedValueOnce(null);

      const saved = await http().put('/api/citizens/me').set(citizenHeaders).send({ district: 'COLOMBO', phone: '077-123-4567' });
      expect(saved.status).toBe(200);
      expect(t.directory.register).toHaveBeenCalledWith(DEVICE_ID, 'COLOMBO', '+94771234567');

      expect((await http().get('/api/citizens/me').set(citizenHeaders)).body.district).toBe('COLOMBO');
      expect((await http().get('/api/citizens/me').set(citizenHeaders)).status).toBe(404);
    });

    it('rejects a bad phone number', async () => {
      const response = await http().put('/api/citizens/me').set(citizenHeaders).send({ district: 'COLOMBO', phone: '911' });
      expect(response.status).toBe(400);
    });

    it('lists and acknowledges alerts', async () => {
      const active = issuedWarning({ validUntil: new Date(future()) });
      t.deliveries.listForDevice.mockResolvedValue([delivery()]);
      t.warnings.findByIds.mockResolvedValue([active]);
      t.warnings.findById.mockResolvedValue(active);
      t.deliveries.acknowledge.mockResolvedValue(delivery({ acknowledgedAt: new Date() }));

      const list = await http().get('/api/alerts/mine').set(citizenHeaders);
      expect(list.body).toEqual([expect.objectContaining({ id: WARNING_ID, state: 'ACTIVE', acknowledgedAt: null })]);

      const ack = await http().post(`/api/alerts/${WARNING_ID}/acknowledge`).set(citizenHeaders);
      expect(ack.status).toBe(200);
      expect(ack.body.acknowledgedAt).not.toBeNull();
    });
  });
});
```

Run: `cd apps/api && bunx vitest run src/hazard-warnings src/citizens`
Expected: PASS.

- [ ] **Step 8: End-to-end flow on `dws_test`** — `apps/api/test/hazard-warnings.e2e.spec.ts`

Copy the top of `apps/api/test/hazard-reports.e2e.spec.ts` (the `environment` block that sets env vars before importing `AppModule`, the `describe.skipIf(!canRunIntegration)` wrapper, the `Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PHOTO_STORAGE)...` bootstrap, `configureApp`, and the collection wipe in `beforeEach`). Wipe these collections in `beforeEach`: `alertDelivery`, `notificationLog`, `hazardWarning`, `citizen`. Then the test:

```ts
  it('registers a citizen, issues a warning, delivers, acknowledges, and cancels with an All Clear', async () => {
    const register = await http()
      .put('/api/citizens/me')
      .set({ 'x-reporter-id': CITIZEN })
      .send({ district: 'COLOMBO', phone: '0771234567' });
    expect(register.status).toBe(200);

    const preview = await http()
      .post('/api/hazard-warnings/preview')
      .set(officer)
      .send({ ...fields });
    expect(preview.body.recipients).toMatchObject({ total: 1, withPhone: 1 });

    const issued = await http()
      .post('/api/hazard-warnings')
      .set(officer)
      .send({ ...fields, clientRequestId: crypto.randomUUID(), action: 'ISSUE' });
    expect(issued.status).toBe(201);
    expect(issued.body.status).toBe('DISSEMINATED');
    expect(issued.body.reference).toMatch(/^HW-\d{4}-\d{4}$/);

    const mine = await http().get('/api/alerts/mine').set({ 'x-reporter-id': CITIZEN });
    expect(mine.body).toEqual([expect.objectContaining({ id: issued.body.id, state: 'ACTIVE' })]);
    const neighbour = await http().get('/api/alerts/mine').set({ 'x-reporter-id': NEIGHBOUR });
    expect(neighbour.body).toEqual([]);

    await http().post(`/api/alerts/${issued.body.id}/acknowledge`).set({ 'x-reporter-id': CITIZEN }).expect(200);

    const detail = await http().get(`/api/hazard-warnings/${issued.body.id}`).set(officer);
    expect(detail.body.acknowledged).toBe(1);
    expect(detail.body.logs).toHaveLength(3);

    await http().post(`/api/hazard-warnings/${issued.body.id}/cancel`).set(officer).send({ reason: 'Water has receded' }).expect(200);

    const after = await http().get('/api/alerts/mine').set({ 'x-reporter-id': CITIZEN });
    expect(after.body[0]).toMatchObject({ state: 'ALL_CLEAR', cancelReason: 'Water has receded' });
  });
```

with, near the top of the file:

```ts
const fields = {
  hazardType: 'FLOOD',
  level: 'HIGH',
  districts: ['COLOMBO'],
  description: 'Heavy rainfall expected in low-lying areas',
  safetyInstructions: ['Move to higher ground immediately'],
  validUntil: new Date(Date.now() + 12 * 3600_000).toISOString(),
};
```

Run: `cd apps/api && bun run test:e2e`
Expected: PASS with `DATABASE_URL_TEST`; skipped without.

- [ ] **Step 9: Full API gate and commit**

Run: `cd apps/api && bun run test:cov && bun run check-types && bun run lint`
Expected: all PASS; coverage table shows `src/hazard-warnings` and `src/citizens` above 80% on all four metrics (target 90%+). If a file is below, add a test for its uncovered branch before committing.

```bash
git add apps/api
git commit -m "feat(api): add hazard warning, citizen and alert endpoints"
```

---
### Task 8: Portal foundation: API client, warning stats, sidebar, shared warning UI

**Files:**
- Modify: `apps/web/src/api/client.ts`, `apps/web/src/api/client.test.ts`, `apps/web/src/api/hazardReports.ts`
- Create: `apps/web/src/api/hazardWarnings.ts`, `apps/web/src/api/hazardWarnings.test.ts`
- Create: `apps/web/src/context/warningStatsContext.ts`, `apps/web/src/context/WarningStatsProvider.tsx`, `apps/web/src/hooks/useWarningStats.ts`
- Create: `apps/web/src/lib/warningLevels.ts`, `apps/web/src/components/warnings/LevelChip.tsx`, `apps/web/src/components/warnings/WarningStatusChip.tsx`, `apps/web/src/components/warnings/chips.test.tsx`
- Modify: `apps/web/src/components/layout/navItems.ts`, `apps/web/src/components/layout/DashboardLayout.tsx`, `apps/web/src/components/layout/DashboardLayout.test.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/test/a11y.test.tsx`, `apps/web/src/components/reports/Pagination.tsx`, `apps/web/src/test/fixtures.ts`

**Interfaces:**
- Consumes: API from Task 7, types from Task 1.
- Produces:

```ts
// api/client.ts (added)
export function toQueryString(query: object): string;
// method now: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
// api/hazardWarnings.ts
export function previewWarning(fields: WarningFields, signal?: AbortSignal): Promise<WarningPreview>;
export function createWarning(input: CreateWarningInput): Promise<HazardWarningDto>;
export function updateDraft(id: string, fields: WarningFields): Promise<HazardWarningDto>;
export function deleteDraft(id: string): Promise<void>;
export function issueDraft(id: string, input?: IssueWarningInput): Promise<HazardWarningDto>;
export function retryWarning(id: string): Promise<HazardWarningDto>;
export function cancelWarning(id: string, input: CancelWarningInput): Promise<HazardWarningDto>;
export function listWarnings(query: ListWarningsQuery, signal?: AbortSignal): Promise<Paginated<HazardWarningDto>>;
export function getWarning(id: string, signal?: AbortSignal): Promise<HazardWarningDetailDto>;
export function getWarningStats(signal?: AbortSignal): Promise<WarningStats>;
export function getPrefill(reportId: string, signal?: AbortSignal): Promise<WarningPrefill>;
export function describeWarningError(error: unknown): string;
// hooks/useWarningStats.ts
export function useWarningStats(): { stats: WarningStats | null; refresh: () => void };  // safe outside the provider
// lib/warningLevels.ts
export const LEVEL_CLASSES: Record<WarningLevel, string>;
export function levelColor(level: WarningLevel | ''): string;
// components
export function LevelChip({ level }: { level: WarningLevel }): JSX.Element;
export function WarningStatusChip({ warning }: { warning: Pick<HazardWarningDto, 'status' | 'active'> }): JSX.Element;
// test/fixtures.ts (added)
export function warning(overrides?): HazardWarningDto;
export function warningDetail(overrides?): HazardWarningDetailDto;
export const warningStats: WarningStats;
export function preview(overrides?): WarningPreview;
```

- [ ] **Step 1: Write failing client tests** — append to `apps/web/src/api/hazardWarnings.test.ts` (new file; mirror the `fetch` stubbing used in `api/hazardReports.test.ts`: open it and copy its `mockFetch` helper and `afterEach(vi.unstubAllGlobals)`)

```ts
import { describe, expect, it, vi } from 'vitest';

import { ApiError, NetworkError, toQueryString } from './client';
import {
  cancelWarning,
  createWarning,
  deleteDraft,
  describeWarningError,
  getPrefill,
  listWarnings,
  previewWarning,
  retryWarning,
} from './hazardWarnings';

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const fields = { hazardType: 'FLOOD', level: 'HIGH', districts: ['COLOMBO'] } as const;

describe('hazard warning API client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts JSON with the officer headers', async () => {
    const fetchMock = mockFetch(201, { id: 'w1' });

    await createWarning({ ...fields, districts: ['COLOMBO'], clientRequestId: 'c1', action: 'DRAFT' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:3000/api/hazard-warnings');
    expect(init).toMatchObject({ method: 'POST', headers: expect.objectContaining({ 'content-type': 'application/json', 'x-officer-key': 'test-officer-key' }) });
    expect(JSON.parse(init.body)).toMatchObject({ action: 'DRAFT' });
  });

  it('uses the right path and method for each action', async () => {
    const fetchMock = mockFetch(200, {});
    await previewWarning({ ...fields, districts: ['COLOMBO'] });
    await retryWarning('w 1');
    await cancelWarning('w1', { reason: 'Water receded' });
    await getPrefill('r1');
    await listWarnings({ view: 'drafts', page: 2 });

    expect(fetchMock.mock.calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      'POST http://localhost:3000/api/hazard-warnings/preview',
      'POST http://localhost:3000/api/hazard-warnings/w%201/retry',
      'POST http://localhost:3000/api/hazard-warnings/w1/cancel',
      'GET http://localhost:3000/api/hazard-warnings/prefill?reportId=r1',
      'GET http://localhost:3000/api/hazard-warnings?view=drafts&page=2',
    ]);
  });

  it('accepts an empty 204 answer', async () => {
    mockFetch(204, undefined);
    await expect(deleteDraft('w1')).resolves.toBeUndefined();
  });

  it('builds query strings without undefined values', () => {
    expect(toQueryString({ view: 'past', page: undefined })).toBe('?view=past');
    expect(toQueryString({})).toBe('');
  });

  it('shows the server explanation for validation and conflicts', () => {
    expect(describeWarningError(new ApiError(409, 'An active HIGH Flood warning already covers Colombo.'))).toBe(
      'An active HIGH Flood warning already covers Colombo.',
    );
    expect(describeWarningError(new ApiError(400, 'add at least one safety instruction'))).toBe('add at least one safety instruction');
    expect(describeWarningError(new ApiError(404, 'x'))).toBe('This warning could not be found.');
    expect(describeWarningError(new NetworkError())).toBe('Cannot reach the server. Check your connection and try again.');
  });
});
```

Run: `cd apps/web && bunx vitest run src/api/hazardWarnings.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: Extend `api/client.ts`**

Change the `method` union in `RequestOptions` to `'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'`. Add below `request`:

```ts
/** "?a=1&b=2" from the defined values, or "" when there are none. */
export function toQueryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}
```

In `api/hazardReports.ts` delete the local `toQueryString` and import it from `./client`. (204 already works: `response.json()` fails, the payload is `undefined`, and `response.ok` is true.)

- [ ] **Step 3: Create `api/hazardWarnings.ts`**

```ts
import type {
  CancelWarningInput,
  CreateWarningInput,
  HazardWarningDetailDto,
  HazardWarningDto,
  IssueWarningInput,
  ListWarningsQuery,
  Paginated,
  WarningFields,
  WarningPrefill,
  WarningPreview,
  WarningStats,
} from '@repo/types';

import { ApiError, describeError, request, toQueryString } from './client';

const BASE = '/api/hazard-warnings';
const path = (id: string, action = '') => `${BASE}/${encodeURIComponent(id)}${action}`;

export function previewWarning(fields: WarningFields, signal?: AbortSignal): Promise<WarningPreview> {
  return request(`${BASE}/preview`, { method: 'POST', body: fields, signal });
}

export function createWarning(input: CreateWarningInput): Promise<HazardWarningDto> {
  return request(BASE, { method: 'POST', body: input });
}

export function updateDraft(id: string, fields: WarningFields): Promise<HazardWarningDto> {
  return request(path(id), { method: 'PATCH', body: fields });
}

export async function deleteDraft(id: string): Promise<void> {
  await request<undefined>(path(id), { method: 'DELETE' });
}

export function issueDraft(id: string, input: IssueWarningInput = {}): Promise<HazardWarningDto> {
  return request(path(id, '/issue'), { method: 'POST', body: input });
}

export function retryWarning(id: string): Promise<HazardWarningDto> {
  return request(path(id, '/retry'), { method: 'POST' });
}

export function cancelWarning(id: string, input: CancelWarningInput): Promise<HazardWarningDto> {
  return request(path(id, '/cancel'), { method: 'POST', body: input });
}

export function listWarnings(query: ListWarningsQuery, signal?: AbortSignal): Promise<Paginated<HazardWarningDto>> {
  return request(`${BASE}${toQueryString(query)}`, { signal });
}

export function getWarning(id: string, signal?: AbortSignal): Promise<HazardWarningDetailDto> {
  return request(path(id), { signal });
}

export function getWarningStats(signal?: AbortSignal): Promise<WarningStats> {
  return request(`${BASE}/stats`, { signal });
}

export function getPrefill(reportId: string, signal?: AbortSignal): Promise<WarningPrefill> {
  return request(`${BASE}/prefill${toQueryString({ reportId })}`, { signal });
}

/**
 * Validation and conflict answers from the warnings API are written for the
 * officer (missing details, a duplicate warning), so they are shown as they are.
 */
export function describeWarningError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 409) return error.message;
    if (error.status === 404) return 'This warning could not be found.';
  }
  return describeError(error);
}
```

Run: `cd apps/web && bunx vitest run src/api`
Expected: PASS.

- [ ] **Step 4: Warning stats context** (same shape as the report stats context)

```ts
// context/warningStatsContext.ts
import { createContext } from 'react';

import type { WarningStats } from '@repo/types';

export interface WarningStatsValue {
  /** Null until the first load finishes. */
  stats: WarningStats | null;
  refresh: () => void;
}

export const WarningStatsContext = createContext<WarningStatsValue | null>(null);
```

```tsx
// context/WarningStatsProvider.tsx
import type { ReactNode } from 'react';

import { getWarningStats } from '../api/hazardWarnings';
import { useResource } from '../hooks/useResource';
import { WarningStatsContext } from './warningStatsContext';

/** One shared copy of the warning counts for the sidebar badge. */
export function WarningStatsProvider({ children }: { children: ReactNode }) {
  const { data, reload } = useResource((signal) => getWarningStats(signal), []);
  return (
    <WarningStatsContext.Provider value={{ stats: data, refresh: reload }}>
      {children}
    </WarningStatsContext.Provider>
  );
}
```

```ts
// hooks/useWarningStats.ts
import { useContext } from 'react';

import { WarningStatsContext, type WarningStatsValue } from '../context/warningStatsContext';

const NONE: WarningStatsValue = { stats: null, refresh: () => undefined };

/** Outside the dashboard (a page rendered on its own in a test) there is simply nothing to refresh. */
export function useWarningStats(): WarningStatsValue {
  return useContext(WarningStatsContext) ?? NONE;
}
```

- [ ] **Step 5: Sidebar entries and badge**

`components/layout/navItems.ts`:

```ts
import { CircleCheck, CircleX, FileText, Megaphone, TriangleAlert, type LucideIcon } from 'lucide-react';

export type NavBadge = 'pendingReports' | 'activeWarnings';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** A count shown next to the label. */
  badge?: NavBadge;
  /** Only active on this exact path, not on paths below it. */
  end?: boolean;
}

/**
 * Add an entry here to put a page in the sidebar. Each use case owns its own
 * entries, so the layout itself never needs to change.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/reports/pending', label: 'Pending Reports', icon: FileText, badge: 'pendingReports' },
  { to: '/reports/verified', label: 'Verified Reports', icon: CircleCheck },
  { to: '/reports/rejected', label: 'Rejected Reports', icon: CircleX },
  { to: '/warnings/new', label: 'Issue Warning', icon: Megaphone },
  { to: '/warnings', label: 'Warnings', icon: TriangleAlert, badge: 'activeWarnings', end: true },
];
```

In `DashboardLayout.tsx`:
- import `WarningStatsProvider` and `useWarningStats`;
- in `Sidebar`, add `const { stats: warningStats } = useWarningStats();` and

```tsx
  const counts: Record<NavBadge, number> = {
    pendingReports: stats?.pending ?? 0,
    activeWarnings: warningStats?.active ?? 0,
  };
  const spoken: Record<NavBadge, string> = { pendingReports: 'pending', activeWarnings: 'active' };
```

- change the map to `NAV_ITEMS.map(({ to, label, icon: Icon, badge, end }) =>`, pass `end={end}` to `NavLink`, and replace the badge JSX with

```tsx
              {badge && counts[badge] > 0 && (
                <span className="bg-orange rounded-full px-2 py-0.5 text-xs font-semibold">
                  <span className="sr-only">
                    {counts[badge]} {spoken[badge]}:{' '}
                  </span>
                  {counts[badge]}
                </span>
              )}
```

- wrap: `<ReportStatsProvider><WarningStatsProvider><Shell /></WarningStatsProvider></ReportStatsProvider>`.

In `components/reports/Pagination.tsx` add a prop `noun = 'reports'` to `PaginationProps` (`/** Plural word for the items, e.g. "warnings". */ noun?: string;`) and use it in `Showing {first}–{last} of {total} {noun}`.

- [ ] **Step 6: Keep the existing layout tests green and add the badge test**

In `DashboardLayout.test.tsx`, `App.test.tsx` and `test/a11y.test.tsx` add (path relative to each file):

```ts
vi.mock('../../api/hazardWarnings', () => ({
  getWarningStats: vi.fn().mockResolvedValue({ active: 0, drafts: 0, issuedToday: 0 }),
}));
```

(`'./api/hazardWarnings'` from `App.test.tsx`, `'../api/hazardWarnings'` from `a11y.test.tsx`.) Then add to `DashboardLayout.test.tsx`:

```ts
  it('links the warning pages and counts active warnings', async () => {
    vi.mocked(getWarningStats).mockResolvedValue({ active: 2, drafts: 0, issuedToday: 1 });
    renderLayout('/warnings');

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: /Issue Warning/ })).toHaveAttribute('href', '/warnings/new');
    const warnings = within(nav).getByRole('link', { name: /^Warnings/ });
    expect(warnings).toHaveAttribute('aria-current', 'page');
    expect(await within(warnings).findByText('2 active:')).toBeInTheDocument();
  });
```

with `import { getWarningStats } from '../../api/hazardWarnings';` at the top.

Run: `cd apps/web && bunx vitest run src/components/layout src/App.test.tsx src/test/a11y.test.tsx`
Expected: PASS.

- [ ] **Step 7: Level styles and chips**

`lib/warningLevels.ts`:

```ts
import type { WarningLevel } from '@repo/types';

/** Same colours as the wireframe's level buttons, all from the theme tokens. */
export const LEVEL_CLASSES: Record<WarningLevel, string> = {
  CRITICAL: 'bg-danger text-white',
  HIGH: 'bg-orange text-white',
  MEDIUM: 'bg-warning-tint text-warning-text',
  LOW: 'bg-success text-white',
};

const LEVEL_TOKENS: Record<WarningLevel, string> = {
  CRITICAL: '--color-danger',
  HIGH: '--color-orange',
  MEDIUM: '--color-warning-text',
  LOW: '--color-success',
};

/** The map draws with SVG attributes, which cannot read CSS variables, so the token is resolved here. */
export function levelColor(level: WarningLevel | ''): string {
  const token = level === '' ? '--color-navy' : LEVEL_TOKENS[level];
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value === '' ? '#17324d' : value;
}
```

`components/warnings/LevelChip.tsx`:

```tsx
import { WARNING_LEVEL_LABELS, type WarningLevel } from '@repo/types';

import { LEVEL_CLASSES } from '../../lib/warningLevels';

export function LevelChip({ level }: { level: WarningLevel }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase ${LEVEL_CLASSES[level]}`}>
      {WARNING_LEVEL_LABELS[level]}
    </span>
  );
}
```

`components/warnings/WarningStatusChip.tsx`:

```tsx
import { WARNING_STATUS_LABELS, type HazardWarningDto, type WarningStatus } from '@repo/types';

const STATUS_CLASSES: Record<WarningStatus, string> = {
  DRAFT: 'bg-neutral-tint text-muted',
  DISSEMINATING: 'bg-warning-tint text-warning-text',
  DISSEMINATED: 'bg-success-tint text-success',
  PARTIALLY_DISSEMINATED: 'bg-warning-tint text-warning-text',
  PENDING_DISSEMINATION: 'bg-danger-tint text-danger',
  CANCELLED: 'bg-neutral-tint text-muted',
};

const ISSUED: WarningStatus[] = ['DISSEMINATING', 'DISSEMINATED', 'PARTIALLY_DISSEMINATED', 'PENDING_DISSEMINATION'];

/** Status with a dot, plus "Expired" for an issued warning whose period is over. */
export function WarningStatusChip({ warning }: { warning: Pick<HazardWarningDto, 'status' | 'active'> }) {
  const expired = ISSUED.includes(warning.status) && !warning.active;
  const classes = expired ? STATUS_CLASSES.CANCELLED : STATUS_CLASSES[warning.status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${classes}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {expired ? 'Expired' : WARNING_STATUS_LABELS[warning.status]}
    </span>
  );
}
```

`components/warnings/chips.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { levelColor } from '../../lib/warningLevels';
import { LevelChip } from './LevelChip';
import { WarningStatusChip } from './WarningStatusChip';

describe('warning chips', () => {
  it('labels each level', () => {
    render(<LevelChip level="CRITICAL" />);
    expect(screen.getByText('Critical')).toHaveClass('bg-danger');
  });

  it('shows the status, or Expired once an issued warning is over', () => {
    const { rerender } = render(<WarningStatusChip warning={{ status: 'PARTIALLY_DISSEMINATED', active: true }} />);
    expect(screen.getByText('Partially Disseminated')).toBeInTheDocument();

    rerender(<WarningStatusChip warning={{ status: 'DISSEMINATED', active: false }} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();

    rerender(<WarningStatusChip warning={{ status: 'DRAFT', active: false }} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('falls back to navy when the theme is not loaded', () => {
    expect(levelColor('HIGH')).toBe('#17324d');
  });
});
```

- [ ] **Step 8: Test fixtures** — append to `apps/web/src/test/fixtures.ts`

```ts
import type {
  HazardWarningDetailDto,
  HazardWarningDto,
  WarningPreview,
  WarningStats,
} from '@repo/types';

export function warning(overrides: Partial<HazardWarningDto> = {}): HazardWarningDto {
  return {
    id: '6700aa77bcf86cd799439011',
    reference: 'HW-2026-0007',
    hazardType: 'FLOOD',
    level: 'HIGH',
    description: 'Heavy rainfall expected. Immediate evacuation recommended for low-lying areas.',
    safetyInstructions: ['Move to higher ground immediately', 'Avoid walking through floodwater'],
    districts: ['COLOMBO'],
    validFrom: minutesAgo(10),
    validUntil: new Date(NOW.getTime() + 12 * 3600_000).toISOString(),
    status: 'DISSEMINATED',
    active: true,
    channels: [
      { channel: 'PUSH', state: 'SENT', recipients: 1245, delivered: 1245, attempts: 1, sentAt: minutesAgo(9) },
      { channel: 'SMS', state: 'SENT', recipients: 900, delivered: 900, attempts: 1, sentAt: minutesAgo(9) },
      { channel: 'AUDIBLE', state: 'SENT', recipients: 1, delivered: 1, attempts: 1, sentAt: minutesAgo(9) },
    ],
    createdBy: 'Officer Silva',
    issuedBy: 'Officer Silva',
    issuedAt: minutesAgo(10),
    createdAt: minutesAgo(10),
    updatedAt: minutesAgo(9),
    ...overrides,
  };
}

export function warningDetail(overrides: Partial<HazardWarningDetailDto> = {}): HazardWarningDetailDto {
  return {
    ...warning(),
    logs: [
      {
        id: 'l1',
        channel: 'PUSH',
        kind: 'WARNING',
        outcome: 'SENT',
        message: 'Push notification delivered to 1245 citizens',
        recipients: 1245,
        createdAt: minutesAgo(9),
      },
    ],
    acknowledged: 312,
    ...overrides,
  };
}

export const warningStats: WarningStats = { active: 1, drafts: 2, issuedToday: 3 };

export function preview(overrides: Partial<WarningPreview> = {}): WarningPreview {
  return {
    recipients: { total: 4325, withPhone: 2100, byDistrict: { COLOMBO: 4325 } },
    duplicates: [],
    ...overrides,
  };
}
```

(Merge the `import type` into the file's existing `@repo/types` import.)

- [ ] **Step 9: Gate and commit**

Run: `cd apps/web && bun run test && bun run check-types && bun run lint`
Expected: PASS.

```bash
git add apps/web
git commit -m "feat(web): add warning API client, stats badge and level chips"
```

---
### Task 9: Portal screen 1: Issue Hazard Warning form (new, edit draft, from report)

**Files:**
- Create: `apps/web/src/lib/warningForm.ts`, `apps/web/src/lib/warningForm.test.ts`
- Create: `apps/web/src/components/warnings/LevelPicker.tsx`, `DistrictPicker.tsx`, `SafetyInstructionsField.tsx`, `DistrictMap.tsx`, `fields.test.tsx`
- Create: `apps/web/src/pages/WarningFormPage.tsx`, `apps/web/src/pages/WarningFormPage.test.tsx`
- Modify: `apps/web/src/App.tsx` (routes for this and the next two tasks), `apps/web/src/lib/routes.ts`

**Interfaces:**
- Consumes: Task 8 API client, chips, `levelColor`; `Field`, `INPUT_CLASSES`, `Button`, `Card`, `Banner`, `Skeleton`, `useResource`, `usePageTitle` (existing).
- Produces:

```ts
// lib/warningForm.ts
export interface WarningForm { hazardType: HazardType | ''; level: WarningLevel | ''; description: string; additionalInfo: string; safetyInstructions: string[]; districts: District[]; validFrom: string; validUntil: string; sourceReportId?: string; reportReference?: string }
export type WarningFormField = 'hazardType' | 'level' | 'description' | 'safetyInstructions' | 'districts' | 'validUntil';
export type WarningFormErrors = Partial<Record<WarningFormField, string>>;
export const FIELD_IDS: Record<WarningFormField, string>;
export interface WarningReviewState { form: WarningForm; clientRequestId: string; draftId?: string }
export function toLocalInput(date: Date): string;
export function emptyForm(now?: Date): WarningForm;
export function formFromWarning(warning: HazardWarningDto): WarningForm;
export function formFromPrefill(prefill: WarningPrefill, now?: Date): WarningForm;
export function validateForm(form: WarningForm, mode: 'draft' | 'issue', now?: Date): WarningFormErrors;
export function toFields(form: WarningForm): WarningFields;
// lib/routes.ts (added)
export const WARNINGS_PATH = '/warnings'; export const NEW_WARNING_PATH = '/warnings/new'; export const REVIEW_WARNING_PATH = '/warnings/review';
export function warningPath(id: string): string; export function editWarningPath(id: string): string;
// components
LevelPicker({ value, onChange, error }), DistrictPicker({ value, onChange, error }), SafetyInstructionsField({ value, onChange, error }), DistrictMap({ districts, level, onToggle })
```

- [ ] **Step 1: Write failing form-logic tests** — `lib/warningForm.test.ts`

```ts
import { describe, expect, it } from 'vitest';

import { NOW, warning } from '../test/fixtures';
import {
  emptyForm,
  formFromPrefill,
  formFromWarning,
  toFields,
  toLocalInput,
  validateForm,
  type WarningForm,
} from './warningForm';

function filled(overrides: Partial<WarningForm> = {}): WarningForm {
  return {
    ...emptyForm(NOW),
    hazardType: 'FLOOD',
    level: 'HIGH',
    description: 'Heavy rainfall expected in low-lying areas',
    safetyInstructions: ['Move to higher ground', '  '],
    districts: ['COLOMBO'],
    ...overrides,
  };
}

describe('warning form', () => {
  it('starts now and lasts 12 hours, with one empty instruction row', () => {
    const form = emptyForm(NOW);
    expect(form.validFrom).toBe(toLocalInput(NOW));
    expect(form.validUntil).toBe(toLocalInput(new Date(NOW.getTime() + 12 * 3600_000)));
    expect(form.safetyInstructions).toEqual(['']);
  });

  it('needs only type, level and districts for a draft', () => {
    expect(validateForm(emptyForm(NOW), 'draft', NOW)).toEqual({
      hazardType: 'Choose a hazard type.',
      level: 'Choose a warning level.',
      districts: 'Select at least one affected district.',
    });
    expect(validateForm(filled({ description: '' }), 'draft', NOW)).toEqual({});
  });

  it('needs the description, an instruction and a future end to issue', () => {
    expect(
      validateForm(filled({ description: 'short', safetyInstructions: [' '], validUntil: toLocalInput(new Date(NOW.getTime() - 60_000)) }), 'issue', NOW),
    ).toEqual({
      description: 'Describe the warning in at least 10 characters.',
      safetyInstructions: 'Add at least one safety instruction.',
      validUntil: 'The end time must be in the future.',
    });
  });

  it('rejects an end before the start in both modes', () => {
    const backwards = filled({ validFrom: toLocalInput(NOW), validUntil: toLocalInput(new Date(NOW.getTime() - 3600_000)) });
    expect(validateForm(backwards, 'draft', NOW).validUntil).toBe('The end time must be after the start time.');
  });

  it('turns the form into API fields, dropping blank rows and text', () => {
    const fields = toFields(filled({ additionalInfo: '  ', sourceReportId: 'r1' }));
    expect(fields).toMatchObject({
      hazardType: 'FLOOD',
      level: 'HIGH',
      districts: ['COLOMBO'],
      description: 'Heavy rainfall expected in low-lying areas',
      additionalInfo: undefined,
      safetyInstructions: ['Move to higher ground'],
      sourceReportId: 'r1',
    });
    expect(new Date(fields.validUntil!).getTime()).toBe(new Date(filled().validUntil).getTime());
  });

  it('loads a draft and a prefill', () => {
    expect(formFromWarning(warning({ status: 'DRAFT' }))).toMatchObject({ hazardType: 'FLOOD', districts: ['COLOMBO'] });
    expect(
      formFromPrefill({ hazardType: 'LANDSLIDE', districts: ['KANDY'], description: 'Slope moving', sourceReportId: 'r1', reportReference: 'HR-2026-0001' }, NOW),
    ).toMatchObject({ hazardType: 'LANDSLIDE', level: '', districts: ['KANDY'], reportReference: 'HR-2026-0001' });
  });
});
```

Run: `cd apps/web && bunx vitest run src/lib/warningForm.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: Implement `lib/warningForm.ts`**

```ts
import {
  WARNING_LIMITS,
  type District,
  type HazardType,
  type HazardWarningDto,
  type WarningFields,
  type WarningLevel,
  type WarningPrefill,
} from '@repo/types';

/** Form state. Dates are `datetime-local` values in the officer's own time zone. */
export interface WarningForm {
  hazardType: HazardType | '';
  level: WarningLevel | '';
  description: string;
  additionalInfo: string;
  safetyInstructions: string[];
  districts: District[];
  validFrom: string;
  validUntil: string;
  sourceReportId?: string;
  reportReference?: string;
}

export type WarningFormField = 'hazardType' | 'level' | 'description' | 'safetyInstructions' | 'districts' | 'validUntil';
export type WarningFormErrors = Partial<Record<WarningFormField, string>>;

/** Element ids, in form order, so the first invalid field can be focused. */
export const FIELD_IDS: Record<WarningFormField, string> = {
  hazardType: 'warning-hazard-type',
  level: 'warning-level',
  description: 'warning-description',
  safetyInstructions: 'warning-instruction-0',
  districts: 'district-search',
  validUntil: 'warning-valid-until',
};

/** Carried in router state from the form to the review page and back. */
export interface WarningReviewState {
  form: WarningForm;
  clientRequestId: string;
  draftId?: string;
}

const DEFAULT_HOURS = 12;
const HOUR = 3600_000;
const pad = (value: number) => String(value).padStart(2, '0');

export function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromIso(iso: string | undefined): string {
  return iso ? toLocalInput(new Date(iso)) : '';
}

export function emptyForm(now = new Date()): WarningForm {
  return {
    hazardType: '',
    level: '',
    description: '',
    additionalInfo: '',
    safetyInstructions: [''],
    districts: [],
    validFrom: toLocalInput(now),
    validUntil: toLocalInput(new Date(now.getTime() + DEFAULT_HOURS * HOUR)),
  };
}

export function formFromWarning(warning: HazardWarningDto): WarningForm {
  return {
    hazardType: warning.hazardType,
    level: warning.level,
    description: warning.description ?? '',
    additionalInfo: warning.additionalInfo ?? '',
    safetyInstructions: warning.safetyInstructions.length > 0 ? warning.safetyInstructions : [''],
    districts: warning.districts,
    validFrom: fromIso(warning.validFrom),
    validUntil: fromIso(warning.validUntil),
    sourceReportId: warning.sourceReportId,
  };
}

/** The officer still chooses the level: a report says what happened, not how dangerous it is. */
export function formFromPrefill(prefill: WarningPrefill, now = new Date()): WarningForm {
  return {
    ...emptyForm(now),
    hazardType: prefill.hazardType,
    description: prefill.description,
    districts: prefill.districts,
    sourceReportId: prefill.sourceReportId,
    reportReference: prefill.reportReference,
  };
}

const filledRows = (rows: string[]) => rows.map((row) => row.trim()).filter((row) => row !== '');

export function validateForm(form: WarningForm, mode: 'draft' | 'issue', now = new Date()): WarningFormErrors {
  const errors: WarningFormErrors = {};
  const description = form.description.trim();

  if (form.hazardType === '') errors.hazardType = 'Choose a hazard type.';
  if (form.level === '') errors.level = 'Choose a warning level.';
  if (form.districts.length === 0) errors.districts = 'Select at least one affected district.';

  const tooShort = description.length > 0 && description.length < WARNING_LIMITS.descriptionMin;
  if (tooShort || (mode === 'issue' && description === '')) {
    errors.description = `Describe the warning in at least ${WARNING_LIMITS.descriptionMin} characters.`;
  }
  if (mode === 'issue' && filledRows(form.safetyInstructions).length === 0) {
    errors.safetyInstructions = 'Add at least one safety instruction.';
  }

  const from = form.validFrom ? new Date(form.validFrom) : undefined;
  const until = form.validUntil ? new Date(form.validUntil) : undefined;
  if (from && until && until <= from) {
    errors.validUntil = 'The end time must be after the start time.';
  } else if (mode === 'issue' && !until) {
    errors.validUntil = 'Set when the warning ends.';
  } else if (mode === 'issue' && until && until <= now) {
    errors.validUntil = 'The end time must be in the future.';
  }
  return errors;
}

/** Call only after validateForm passed: type and level are set by then. */
export function toFields(form: WarningForm): WarningFields {
  const text = (value: string) => (value.trim() === '' ? undefined : value.trim());
  const iso = (value: string) => (value === '' ? undefined : new Date(value).toISOString());
  return {
    hazardType: form.hazardType as HazardType,
    level: form.level as WarningLevel,
    districts: form.districts,
    description: text(form.description),
    additionalInfo: text(form.additionalInfo),
    safetyInstructions: filledRows(form.safetyInstructions),
    validFrom: iso(form.validFrom),
    validUntil: iso(form.validUntil),
    sourceReportId: form.sourceReportId,
  };
}
```

Run: `cd apps/web && bunx vitest run src/lib/warningForm.test.ts`
Expected: PASS.

- [ ] **Step 3: Routes helpers** — append to `lib/routes.ts`

```ts
export const WARNINGS_PATH = '/warnings';
export const NEW_WARNING_PATH = '/warnings/new';
export const REVIEW_WARNING_PATH = '/warnings/review';

export function warningPath(id: string): string {
  return `${WARNINGS_PATH}/${encodeURIComponent(id)}`;
}

export function editWarningPath(id: string): string {
  return `${warningPath(id)}/edit`;
}
```

- [ ] **Step 4: Field components**

`components/warnings/LevelPicker.tsx`:

```tsx
import { WARNING_LEVEL_LABELS, WARNING_LEVELS, type WarningLevel } from '@repo/types';

import { LEVEL_CLASSES } from '../../lib/warningLevels';

interface LevelPickerProps {
  value: WarningLevel | '';
  onChange: (level: WarningLevel) => void;
  error?: string;
}

/** The wireframe's four coloured buttons, as one radio group. */
export function LevelPicker({ value, onChange, error }: LevelPickerProps) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">
        Warning level
        <span className="text-danger" aria-hidden="true"> *</span>
      </legend>
      <div
        role="radiogroup"
        aria-label="Warning level"
        aria-describedby={error ? 'warning-level-error' : undefined}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {WARNING_LEVELS.map((level, index) => {
          const checked = value === level;
          return (
            <button
              key={level}
              id={index === 0 ? 'warning-level' : undefined}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(level)}
              className={`h-10 rounded-lg text-sm font-semibold transition ${LEVEL_CLASSES[level]} ${
                checked ? 'ring-ink ring-2 ring-offset-2' : 'opacity-60 hover:opacity-100'
              }`}
            >
              {WARNING_LEVEL_LABELS[level]}
            </button>
          );
        })}
      </div>
      {error && (
        <p id="warning-level-error" role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
```

`components/warnings/DistrictPicker.tsx`:

```tsx
import { X } from 'lucide-react';
import { useState } from 'react';

import { DISTRICTS, districtName, type District } from '@repo/types';

import { Field, INPUT_CLASSES } from '../ui/Field';

const MAX_MATCHES = 6;

interface DistrictPickerProps {
  value: District[];
  onChange: (districts: District[]) => void;
  error?: string;
}

/** Selected districts as removable chips, plus a search box that suggests the rest. */
export function DistrictPicker({ value, onChange, error }: DistrictPickerProps) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches =
    needle === ''
      ? []
      : DISTRICTS.filter((district) => !value.includes(district) && districtName(district).toLowerCase().includes(needle)).slice(0, MAX_MATCHES);

  function add(district: District) {
    onChange([...value, district]);
    setQuery('');
  }

  return (
    <Field label="Affected districts" htmlFor="district-search" required error={error} hint="Type to search, or click near a district on the map.">
      <div className="space-y-2">
        {value.length > 0 && (
          <ul aria-label="Selected districts" className="flex flex-wrap gap-2">
            {value.map((district) => (
              <li key={district}>
                <span className="bg-neutral-tint inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-xs font-semibold">
                  {districtName(district)}
                  <button
                    type="button"
                    aria-label={`Remove ${districtName(district)}`}
                    onClick={() => onChange(value.filter((item) => item !== district))}
                    className="hover:bg-border rounded-full p-1"
                  >
                    <X aria-hidden="true" className="size-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <input
          id="district-search"
          type="search"
          autoComplete="off"
          placeholder="Type to search districts…"
          className={INPUT_CLASSES}
          value={query}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'district-search-error' : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && matches[0]) {
              event.preventDefault();
              add(matches[0]);
            }
          }}
        />
        {matches.length > 0 && (
          <ul aria-label="Matching districts" className="border-border divide-border divide-y rounded-lg border">
            {matches.map((district) => (
              <li key={district}>
                <button type="button" onClick={() => add(district)} className="hover:bg-page w-full px-3 py-2 text-left text-sm">
                  {districtName(district)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}
```

`components/warnings/SafetyInstructionsField.tsx`:

```tsx
import { Plus, Trash2 } from 'lucide-react';

import { WARNING_LIMITS } from '@repo/types';

import { Button } from '../ui/Button';
import { INPUT_CLASSES } from '../ui/Field';

interface SafetyInstructionsFieldProps {
  value: string[];
  onChange: (rows: string[]) => void;
  error?: string;
}

/** Numbered steps the phone shows under the warning (finding UI2). Blank rows are dropped on save. */
export function SafetyInstructionsField({ value, onChange, error }: SafetyInstructionsFieldProps) {
  const setRow = (index: number, text: string) => onChange(value.map((row, i) => (i === index ? text : row)));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">
        Safety instructions
        <span className="text-danger" aria-hidden="true"> *</span>
      </legend>
      <ol className="space-y-2">
        {value.map((row, index) => (
          <li key={index} className="flex items-center gap-2">
            <span aria-hidden="true" className="text-muted w-5 text-sm">
              {index + 1}.
            </span>
            <input
              id={`warning-instruction-${index}`}
              aria-label={`Safety instruction ${index + 1}`}
              aria-invalid={error && index === 0 ? true : undefined}
              aria-describedby={error && index === 0 ? 'safety-instructions-error' : undefined}
              maxLength={WARNING_LIMITS.instructionMax}
              placeholder="e.g. Move to higher ground immediately"
              className={INPUT_CLASSES}
              value={row}
              onChange={(event) => setRow(index, event.target.value)}
            />
            {value.length > 1 && (
              <button
                type="button"
                aria-label={`Remove instruction ${index + 1}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="text-muted hover:text-danger rounded-lg p-2"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ol>
      {value.length < WARNING_LIMITS.instructionsMax && (
        <Button variant="ghost" className="self-start" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => onChange([...value, ''])}>
          Add instruction
        </Button>
      )}
      {error && (
        <p id="safety-instructions-error" role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
```

`components/warnings/DistrictMap.tsx`:

```tsx
import 'leaflet/dist/leaflet.css';

import { Circle, MapContainer, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';

import { DISTRICT_INFO, districtName, nearestDistrict, type District, type WarningLevel } from '@repo/types';

import { levelColor } from '../../lib/warningLevels';

const SRI_LANKA: [number, number] = [7.87, 80.77];
const ZOOM = 7;
const RADIUS_METRES = 18_000;

function ClickToToggle({ onToggle }: { onToggle: (district: District) => void }) {
  useMapEvents({
    click(event) {
      onToggle(nearestDistrict({ latitude: event.latlng.lat, longitude: event.latlng.lng }));
    },
  });
  return null;
}

interface DistrictMapProps {
  districts: District[];
  level: WarningLevel | '';
  onToggle?: (district: District) => void;
}

/**
 * Affected districts as circles in the level's colour (finding UI6). Clicking
 * toggles the nearest district, so the officer never has to draw a shape.
 */
export function DistrictMap({ districts, level, onToggle }: DistrictMapProps) {
  const color = levelColor(level);
  const label =
    districts.length === 0
      ? 'Map of Sri Lanka. No district selected yet.'
      : `Map of the affected area: ${districts.map(districtName).join(', ')}`;

  return (
    <div role="img" aria-label={label} className="border-border h-80 overflow-hidden rounded-lg border">
      <MapContainer center={SRI_LANKA} zoom={ZOOM} scrollWheelZoom={false} className="size-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {districts.map((district) => {
          const { latitude, longitude } = DISTRICT_INFO[district];
          return (
            <Circle key={district} center={[latitude, longitude]} radius={RADIUS_METRES} pathOptions={{ color, fillOpacity: 0.3 }}>
              <Tooltip>{districtName(district)}</Tooltip>
            </Circle>
          );
        })}
        {onToggle && <ClickToToggle onToggle={onToggle} />}
      </MapContainer>
    </div>
  );
}
```

`components/warnings/fields.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { District } from '@repo/types';

import { DistrictPicker } from './DistrictPicker';
import { LevelPicker } from './LevelPicker';
import { SafetyInstructionsField } from './SafetyInstructionsField';

function Districts({ initial = [] as District[] }) {
  const [value, setValue] = useState<District[]>(initial);
  return <DistrictPicker value={value} onChange={setValue} />;
}

function Instructions({ initial }: { initial: string[] }) {
  const [value, setValue] = useState(initial);
  return <SafetyInstructionsField value={value} onChange={setValue} />;
}

describe('LevelPicker', () => {
  it('is a radio group that reports the chosen level and shows an error', async () => {
    const onChange = vi.fn();
    render(<LevelPicker value="HIGH" onChange={onChange} error="Choose a warning level." />);

    expect(screen.getByRole('radio', { name: 'High' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Critical' }));
    expect(onChange).toHaveBeenCalledWith('CRITICAL');
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a warning level.');
  });
});

describe('DistrictPicker', () => {
  it('suggests matching districts and adds one by click or Enter', async () => {
    render(<Districts />);

    await userEvent.type(screen.getByLabelText(/Affected districts/), 'gam');
    await userEvent.click(screen.getByRole('button', { name: 'Gampaha' }));
    await userEvent.type(screen.getByLabelText(/Affected districts/), 'colo{Enter}');

    const selected = screen.getByRole('list', { name: 'Selected districts' });
    expect(selected).toHaveTextContent('Gampaha');
    expect(selected).toHaveTextContent('Colombo');
  });

  it('does not suggest a district that is already selected, and removes one', async () => {
    render(<Districts initial={['COLOMBO']} />);

    await userEvent.type(screen.getByLabelText(/Affected districts/), 'colombo');
    expect(screen.queryByRole('list', { name: 'Matching districts' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Colombo' }));
    expect(screen.queryByRole('list', { name: 'Selected districts' })).not.toBeInTheDocument();
  });
});

describe('SafetyInstructionsField', () => {
  it('adds, edits and removes numbered rows', async () => {
    render(<Instructions initial={['Move to higher ground']} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add instruction' }));
    await userEvent.type(screen.getByLabelText('Safety instruction 2'), 'Keep a kit ready');
    expect(screen.getByLabelText('Safety instruction 2')).toHaveValue('Keep a kit ready');

    await userEvent.click(screen.getByRole('button', { name: 'Remove instruction 1' }));
    expect(screen.getByLabelText('Safety instruction 1')).toHaveValue('Keep a kit ready');
    expect(screen.queryByRole('button', { name: /Remove instruction/ })).not.toBeInTheDocument();
  });

  it('stops offering rows at the limit', () => {
    render(<Instructions initial={Array(8).fill('Stay indoors')} />);
    expect(screen.queryByRole('button', { name: 'Add instruction' })).not.toBeInTheDocument();
  });
});
```

Run: `cd apps/web && bunx vitest run src/components/warnings`
Expected: PASS.

- [ ] **Step 5: Write failing page tests** — `pages/WarningFormPage.test.tsx`

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStats } from '../api/hazardReports';
import { createWarning, getPrefill, getWarning, updateDraft } from '../api/hazardWarnings';
import { stats, warning } from '../test/fixtures';
import { renderPage } from '../test/render';
import { WarningFormPage } from './WarningFormPage';

vi.mock('../api/hazardReports', () => ({ getStats: vi.fn() }));
vi.mock('../api/hazardWarnings', () => ({
  createWarning: vi.fn(),
  updateDraft: vi.fn(),
  getWarning: vi.fn(),
  getPrefill: vi.fn(),
  describeWarningError: (error: Error) => error.message,
}));
vi.mock('../components/warnings/DistrictMap', () => ({
  DistrictMap: ({ districts, onToggle }: { districts: string[]; onToggle: (d: string) => void }) => (
    <button type="button" onClick={() => onToggle('KANDY')}>
      map: {districts.join(',')}
    </button>
  ),
}));

/** Shows where the form navigated and what it carried. */
function Landing() {
  const location = useLocation();
  return <pre data-testid="landing">{JSON.stringify({ path: location.pathname + location.search, state: location.state })}</pre>;
}

function renderForm(at = '/warnings/new', path = '/warnings/new') {
  return renderPage(
    <Routes>
      <Route path={path} element={<WarningFormPage />} />
      <Route path="*" element={<Landing />} />
    </Routes>,
    { at },
  );
}

async function fillRequired() {
  await userEvent.selectOptions(screen.getByLabelText(/Hazard type/), 'FLOOD');
  await userEvent.click(screen.getByRole('radio', { name: 'High' }));
  await userEvent.type(screen.getByLabelText(/Description/), 'Heavy rainfall expected in low-lying areas');
  await userEvent.type(screen.getByLabelText('Safety instruction 1'), 'Move to higher ground');
  await userEvent.type(screen.getByLabelText(/Affected districts/), 'colombo{Enter}');
}

const landing = () => JSON.parse(screen.getByTestId('landing').textContent ?? '{}');

describe('WarningFormPage', () => {
  beforeEach(() => {
    vi.mocked(getStats).mockResolvedValue(stats);
    vi.mocked(createWarning).mockReset().mockResolvedValue(warning({ status: 'DRAFT', reference: 'HW-2026-0008' }));
    vi.mocked(updateDraft).mockReset().mockResolvedValue(warning({ status: 'DRAFT' }));
  });

  it('lays out the wireframe sections', async () => {
    renderForm();
    expect(await screen.findByRole('heading', { name: 'Issue Hazard Warning' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Warning Incident Details' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Affected Area Map' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as Draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review Warning' })).toBeInTheDocument();
  });

  it('blocks review and focuses the first problem', async () => {
    renderForm();
    await userEvent.click(await screen.findByRole('button', { name: 'Review Warning' }));

    expect(screen.getByText('Choose a hazard type.')).toBeInTheDocument();
    expect(screen.getByText('Add at least one safety instruction.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Hazard type/)).toHaveFocus();
  });

  it('goes to review carrying the form and a request id', async () => {
    renderForm();
    await screen.findByRole('heading', { name: 'Issue Hazard Warning' });
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Review Warning' }));

    const { path, state } = landing();
    expect(path).toBe('/warnings/review');
    expect(state.form).toMatchObject({ hazardType: 'FLOOD', level: 'HIGH', districts: ['COLOMBO'] });
    expect(state.clientRequestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('adds a district from the map', async () => {
    renderForm();
    await userEvent.click(await screen.findByRole('button', { name: /map:/ }));
    expect(screen.getByRole('list', { name: 'Selected districts' })).toHaveTextContent('Kandy');
  });

  it('saves a new draft and goes to the drafts list', async () => {
    renderForm();
    await screen.findByRole('heading', { name: 'Issue Hazard Warning' });
    await userEvent.selectOptions(screen.getByLabelText(/Hazard type/), 'FLOOD');
    await userEvent.click(screen.getByRole('radio', { name: 'Low' }));
    await userEvent.type(screen.getByLabelText(/Affected districts/), 'kandy{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Save as Draft' }));

    await waitFor(() => expect(landing().path).toBe('/warnings?view=drafts'));
    expect(createWarning).toHaveBeenCalledWith(expect.objectContaining({ action: 'DRAFT', level: 'LOW', districts: ['KANDY'] }));
    expect(landing().state.notice).toBe('Draft HW-2026-0008 saved.');
  });

  it('keeps the entries and explains a failed save', async () => {
    vi.mocked(createWarning).mockRejectedValue(new Error('Warning could not be saved. Please try again.'));
    renderForm();
    await screen.findByRole('heading', { name: 'Issue Hazard Warning' });
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Save as Draft' }));

    expect(await screen.findByText('Warning could not be saved. Please try again.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toHaveValue('Heavy rainfall expected in low-lying areas');
  });

  it('edits an existing draft', async () => {
    vi.mocked(getWarning).mockResolvedValue({ ...warning({ id: 'w9', status: 'DRAFT' }), logs: [], acknowledged: 0 });
    renderForm('/warnings/w9/edit', '/warnings/:id/edit');

    expect(await screen.findByRole('heading', { name: 'Edit Draft Warning' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save as Draft' }));

    await waitFor(() => expect(updateDraft).toHaveBeenCalledWith('w9', expect.objectContaining({ hazardType: 'FLOOD' })));
  });

  it('starts from a verified report', async () => {
    vi.mocked(getPrefill).mockResolvedValue({
      hazardType: 'LANDSLIDE',
      districts: ['KANDY'],
      description: 'Slope is moving near the school',
      sourceReportId: 'r1',
      reportReference: 'HR-2026-0042',
    });
    renderForm('/warnings/new?fromReport=r1');

    expect(await screen.findByText(/Prefilled from verified report HR-2026-0042/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toHaveValue('Slope is moving near the school');
  });

  it('restores the entries when coming back from review', async () => {
    renderPage(
      <Routes>
        <Route path="/warnings/new" element={<WarningFormPage />} />
      </Routes>,
      {
        at: {
          pathname: '/warnings/new',
          state: { form: { ...warningFormStub(), description: 'Kept from before' }, clientRequestId: 'c1' },
        },
      },
    );
    expect(await screen.findByLabelText(/Description/)).toHaveValue('Kept from before');
  });
});

function warningFormStub() {
  return {
    hazardType: 'FLOOD',
    level: 'HIGH',
    description: '',
    additionalInfo: '',
    safetyInstructions: [''],
    districts: ['COLOMBO'],
    validFrom: '',
    validUntil: '',
  };
}
```

Run: `cd apps/web && bunx vitest run src/pages/WarningFormPage.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 6: Implement `pages/WarningFormPage.tsx`**

```tsx
import { ArrowLeft, FileSearch } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { HAZARD_TYPE_LABELS, HAZARD_TYPES, WARNING_LEVEL_LABELS, WARNING_LEVELS, WARNING_LIMITS, type District } from '@repo/types';

import { createWarning, describeWarningError, getPrefill, getWarning, updateDraft } from '../api/hazardWarnings';
import { DistrictMap } from '../components/warnings/DistrictMap';
import { DistrictPicker } from '../components/warnings/DistrictPicker';
import { LevelPicker } from '../components/warnings/LevelPicker';
import { SafetyInstructionsField } from '../components/warnings/SafetyInstructionsField';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, INPUT_CLASSES } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';
import { useResource } from '../hooks/useResource';
import { useWarningStats } from '../hooks/useWarningStats';
import { LEVEL_CLASSES } from '../lib/warningLevels';
import { REVIEW_WARNING_PATH, WARNINGS_PATH } from '../lib/routes';
import {
  emptyForm,
  FIELD_IDS,
  formFromPrefill,
  formFromWarning,
  toFields,
  validateForm,
  type WarningForm,
  type WarningFormErrors,
  type WarningFormField,
  type WarningReviewState,
} from '../lib/warningForm';

const FIELD_ORDER: WarningFormField[] = ['hazardType', 'level', 'description', 'safetyInstructions', 'districts', 'validUntil'];

/** Screen 1 for a new warning, a draft (`/warnings/:id/edit`), or a verified report (`?fromReport=`). */
export function WarningFormPage() {
  const { id: draftId } = useParams();
  const [params] = useSearchParams();
  const fromReport = params.get('fromReport');
  const location = useLocation();
  const carried = location.state as Partial<WarningReviewState> | null;

  const source = useResource<WarningForm>(async (signal) => {
    if (carried?.form) return carried.form;
    if (draftId) return formFromWarning(await getWarning(draftId, signal));
    if (fromReport) return formFromPrefill(await getPrefill(fromReport, signal));
    return emptyForm();
  }, [draftId, fromReport, location.key]);

  usePageTitle(draftId ? 'Edit draft warning' : 'Issue hazard warning');

  if (source.loading && !source.data) {
    return (
      <div role="status" aria-label="Loading warning form" className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-[32rem]" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (!source.data) {
    return (
      <Banner tone="danger" action={<Button variant="ghost" onClick={source.reload}>Retry</Button>}>
        {describeWarningError(source.error)}
      </Banner>
    );
  }
  return <WarningEditor key={location.key} initial={source.data} draftId={draftId} issueRequestId={carried?.clientRequestId} />;
}

interface WarningEditorProps {
  initial: WarningForm;
  draftId?: string;
  issueRequestId?: string;
}

function WarningEditor({ initial, draftId, issueRequestId }: WarningEditorProps) {
  const navigate = useNavigate();
  const { refresh } = useWarningStats();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<WarningFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  // Separate ids: a draft save that timed out must never turn a later issue into a replay of the draft.
  const [issueId] = useState(() => issueRequestId ?? crypto.randomUUID());
  const [draftRequestId] = useState(() => crypto.randomUUID());

  function update<K extends keyof WarningForm>(key: K, value: WarningForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function toggleDistrict(district: District) {
    update('districts', form.districts.includes(district) ? form.districts.filter((d) => d !== district) : [...form.districts, district]);
  }

  function check(mode: 'draft' | 'issue'): boolean {
    const next = validateForm(form, mode);
    setErrors(next);
    const first = FIELD_ORDER.find((field) => next[field]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
    return first === undefined;
  }

  function review() {
    if (!check('issue')) return;
    const state: WarningReviewState = { form, clientRequestId: issueId, draftId };
    navigate(REVIEW_WARNING_PATH, { state });
  }

  async function saveDraft() {
    if (!check('draft')) return;
    setSaving(true);
    setFailure(null);
    try {
      const fields = toFields(form);
      const saved = draftId
        ? await updateDraft(draftId, fields)
        : await createWarning({ ...fields, clientRequestId: draftRequestId, action: 'DRAFT' });
      refresh();
      navigate(`${WARNINGS_PATH}?view=drafts`, { state: { notice: `Draft ${saved.reference} saved.` } });
    } catch (error) {
      setFailure(error);
    } finally {
      setSaving(false);
    }
  }

  const errorProps = (field: WarningFormField) =>
    errors[field] ? { 'aria-invalid': true, 'aria-describedby': `${FIELD_IDS[field]}-error` } : {};

  return (
    <div className="space-y-4">
      <div>
        <Link to={WARNINGS_PATH} className="text-muted hover:text-ink inline-flex items-center gap-1 text-sm">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to warnings
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{draftId ? 'Edit Draft Warning' : 'Issue Hazard Warning'}</h1>
        <p className="text-muted text-sm">Configure and dispatch a public warning to the affected districts.</p>
      </div>

      {form.reportReference && (
        <Banner tone="success">
          <span className="inline-flex items-center gap-2">
            <FileSearch aria-hidden="true" className="size-4" />
            Prefilled from verified report {form.reportReference}. Check every field and choose the warning level.
          </span>
        </Banner>
      )}
      {failure !== null && <Banner tone="danger">{describeWarningError(failure)}</Banner>}

      <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <Card title="Warning Incident Details">
          <div className="space-y-4">
            <Field label="Hazard type" htmlFor={FIELD_IDS.hazardType} required error={errors.hazardType}>
              <select
                id={FIELD_IDS.hazardType}
                className={INPUT_CLASSES}
                value={form.hazardType}
                {...errorProps('hazardType')}
                onChange={(event) => update('hazardType', event.target.value as WarningForm['hazardType'])}
              >
                <option value="">Select hazard type…</option>
                {HAZARD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {HAZARD_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>

            <LevelPicker value={form.level} onChange={(level) => update('level', level)} error={errors.level} />

            <Field label="Description" htmlFor={FIELD_IDS.description} required error={errors.description} hint="What is happening and who is at risk.">
              <textarea
                id={FIELD_IDS.description}
                rows={4}
                maxLength={WARNING_LIMITS.descriptionMax}
                placeholder="Enter warning description…"
                className={INPUT_CLASSES}
                value={form.description}
                {...errorProps('description')}
                onChange={(event) => update('description', event.target.value)}
              />
            </Field>

            <Field label="Additional information" htmlFor="warning-additional-info" hint="Optional. Shown to officers and on the phone.">
              <input
                id="warning-additional-info"
                maxLength={WARNING_LIMITS.additionalInfoMax}
                placeholder="Enter additional details…"
                className={INPUT_CLASSES}
                value={form.additionalInfo}
                onChange={(event) => update('additionalInfo', event.target.value)}
              />
            </Field>

            <SafetyInstructionsField value={form.safetyInstructions} onChange={(rows) => update('safetyInstructions', rows)} error={errors.safetyInstructions} />

            <DistrictPicker value={form.districts} onChange={(districts) => update('districts', districts)} error={errors.districts} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valid from" htmlFor="warning-valid-from">
                <input
                  id="warning-valid-from"
                  type="datetime-local"
                  className={INPUT_CLASSES}
                  value={form.validFrom}
                  onChange={(event) => update('validFrom', event.target.value)}
                />
              </Field>
              <Field label="Valid until" htmlFor={FIELD_IDS.validUntil} required error={errors.validUntil}>
                <input
                  id={FIELD_IDS.validUntil}
                  type="datetime-local"
                  className={INPUT_CLASSES}
                  value={form.validUntil}
                  {...errorProps('validUntil')}
                  onChange={(event) => update('validUntil', event.target.value)}
                />
              </Field>
            </div>

            <div className="border-border flex flex-wrap justify-end gap-3 border-t pt-4">
              <Button variant="ghost" loading={saving} onClick={saveDraft}>
                Save as Draft
              </Button>
              <Button disabled={saving} onClick={review}>
                Review Warning
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Affected Area Map">
          <DistrictMap districts={form.districts} level={form.level} onToggle={toggleDistrict} />
          <p className="text-muted mt-3 text-xs font-semibold tracking-wide uppercase">Warning level legend</p>
          <ul className="mt-1 flex flex-wrap gap-3 text-xs">
            {WARNING_LEVELS.map((level) => (
              <li key={level} className="flex items-center gap-1">
                <span aria-hidden="true" className={`size-2.5 rounded-full ${LEVEL_CLASSES[level]}`} />
                {WARNING_LEVEL_LABELS[level]}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
```

Note on `Field` errors: `Field` renders the error with id `${htmlFor}-error`, which matches `errorProps` because `FIELD_IDS` are the `htmlFor` values.

- [ ] **Step 7: Register the routes in `App.tsx`** (the review, status and list pages are created in Tasks 10-11; add their imports and routes now only if you are executing the tasks back to back, otherwise add each route in its own task)

```tsx
        <Route path="warnings" element={<WarningsListPage />} />
        <Route path="warnings/new" element={<WarningFormPage />} />
        <Route path="warnings/review" element={<ReviewWarningPage />} />
        <Route path="warnings/:id/edit" element={<WarningFormPage />} />
        <Route path="warnings/:id" element={<WarningStatusPage />} />
```

For this task add only the `warnings/new` and `warnings/:id/edit` routes and the `WarningFormPage` import.

- [ ] **Step 8: Gate and commit**

Run: `cd apps/web && bunx vitest run src/pages/WarningFormPage.test.tsx src/lib src/components/warnings && bun run check-types && bun run lint`
Expected: PASS.

```bash
git add apps/web
git commit -m "feat(web): add the issue hazard warning form with draft and prefill"
```

---
### Task 10: Portal screen 2: Review Warning (recipient count, duplicates, confirm)

**Files:**
- Create: `apps/web/src/pages/ReviewWarningPage.tsx`, `apps/web/src/pages/ReviewWarningPage.test.tsx`
- Modify: `apps/web/src/App.tsx` (route `warnings/review`)

**Interfaces:**
- Consumes: `WarningReviewState`, `toFields` (Task 9), `previewWarning`, `createWarning`, `issueDraft`, `describeWarningError` (Task 8), `LevelChip`, `ConfirmDialog`, `useWarningStats`, `config.officerName`.
- Produces: route `/warnings/review`; on success navigates to `warningPath(id)` with `state.notice = 'Warning HW-… issued.'`.

- [ ] **Step 1: Write failing tests** — `pages/ReviewWarningPage.test.tsx`

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStats } from '../api/hazardReports';
import { createWarning, issueDraft, previewWarning } from '../api/hazardWarnings';
import { NetworkError } from '../api/client';
import { preview, stats, warning } from '../test/fixtures';
import { renderPage } from '../test/render';
import { emptyForm, type WarningReviewState } from '../lib/warningForm';
import { ReviewWarningPage } from './ReviewWarningPage';

vi.mock('../api/hazardReports', () => ({ getStats: vi.fn() }));
vi.mock('../api/hazardWarnings', async () => {
  const actual = await vi.importActual<typeof import('../api/hazardWarnings')>('../api/hazardWarnings');
  return { ...actual, previewWarning: vi.fn(), createWarning: vi.fn(), issueDraft: vi.fn() };
});

function Landing() {
  const location = useLocation();
  return <pre data-testid="landing">{JSON.stringify({ path: location.pathname, state: location.state })}</pre>;
}

const state: WarningReviewState = {
  clientRequestId: '7b0e6c0e-0f5e-4a52-9a77-3d3a0c1f9a11',
  form: {
    ...emptyForm(new Date('2026-10-07T08:00:00Z')),
    hazardType: 'FLOOD',
    level: 'HIGH',
    description: 'Heavy rainfall expected in low-lying areas',
    safetyInstructions: ['Move to higher ground'],
    districts: ['COLOMBO'],
    validUntil: '2099-01-01T08:00',
  },
};

function renderReview(withState: WarningReviewState | null = state) {
  return renderPage(
    <Routes>
      <Route path="/warnings/review" element={<ReviewWarningPage />} />
      <Route path="*" element={<Landing />} />
    </Routes>,
    { at: { pathname: '/warnings/review', state: withState } },
  );
}

const landing = () => JSON.parse(screen.getByTestId('landing').textContent ?? '{}');

describe('ReviewWarningPage', () => {
  beforeEach(() => {
    vi.mocked(getStats).mockResolvedValue(stats);
    vi.mocked(previewWarning).mockReset().mockResolvedValue(preview());
    vi.mocked(createWarning).mockReset().mockResolvedValue(warning({ id: 'w7' }));
    vi.mocked(issueDraft).mockReset().mockResolvedValue(warning({ id: 'w9' }));
  });

  it('redirects to the form when opened directly', async () => {
    renderReview(null);
    await waitFor(() => expect(landing().path).toBe('/warnings/new'));
  });

  it('shows the summary and the number of citizens who will receive it', async () => {
    renderReview();

    expect(await screen.findByRole('heading', { name: 'Review Warning' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Warning Summary' })).toHaveTextContent('Flood');
    expect(await screen.findByText('4,325')).toBeInTheDocument();
    expect(screen.getByText(/2,100 can also receive SMS/)).toBeInTheDocument();
    expect(screen.getByText('Move to higher ground')).toBeInTheDocument();
  });

  it('warns when nobody is registered in the area but still allows issuing', async () => {
    vi.mocked(previewWarning).mockResolvedValue(preview({ recipients: { total: 0, withPhone: 0, byDistrict: { COLOMBO: 0 } } }));
    renderReview();

    expect(await screen.findByText('No registered recipients found for the selected area.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Warning' })).toBeEnabled();
  });

  it('needs "issue anyway" when an active warning already covers the area', async () => {
    vi.mocked(previewWarning).mockResolvedValue(preview({ duplicates: [warning({ id: 'w1', reference: 'HW-2026-0001' })] }));
    renderReview();

    expect(await screen.findByRole('link', { name: 'HW-2026-0001' })).toHaveAttribute('href', '/warnings/w1');
    const confirm = screen.getByRole('button', { name: 'Confirm Warning' });
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox', { name: /Issue anyway/ }));
    await userEvent.click(confirm);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Issue warning' }));

    await waitFor(() => expect(createWarning).toHaveBeenCalledWith(expect.objectContaining({ action: 'ISSUE', force: true })));
  });

  it('confirms twice, then opens the status page', async () => {
    renderReview();
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm Warning' }));

    const dialog = await screen.findByRole('dialog', { name: 'Issue this warning?' });
    expect(dialog).toHaveTextContent('cannot be recalled');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Issue warning' }));

    await waitFor(() => expect(landing().path).toBe('/warnings/w7'));
    expect(createWarning).toHaveBeenCalledWith(
      expect.objectContaining({ clientRequestId: state.clientRequestId, action: 'ISSUE', force: false, districts: ['COLOMBO'] }),
    );
    expect(landing().state.notice).toBe('Warning HW-2026-0007 issued.');
  });

  it('issues a draft by its id', async () => {
    renderReview({ ...state, draftId: 'w9' });
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm Warning' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Issue warning' }));

    await waitFor(() => expect(issueDraft).toHaveBeenCalledWith('w9', { force: false }));
  });

  it('keeps everything on screen when the connection drops', async () => {
    vi.mocked(createWarning).mockRejectedValue(new NetworkError());
    renderReview();
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm Warning' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Issue warning' }));

    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Warning Summary' })).toBeInTheDocument();
  });

  it('Back keeps entries', async () => {
    renderReview();
    await userEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(landing().path).toBe('/warnings/new');
    expect(landing().state).toEqual({ form: state.form, clientRequestId: state.clientRequestId });
  });

  it('Cancel asks before discarding', async () => {
    renderReview();
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Discard this warning?' })).getByRole('button', { name: 'Discard' }));

    expect(landing().path).toBe('/warnings');
  });

  it('offers a retry when the preview fails', async () => {
    vi.mocked(previewWarning).mockRejectedValueOnce(new NetworkError());
    renderReview();

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('4,325')).toBeInTheDocument();
  });
});
```

Add `within` to the `@testing-library/react` import.

Run: `cd apps/web && bunx vitest run src/pages/ReviewWarningPage.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 2: Implement `pages/ReviewWarningPage.tsx`**

```tsx
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { districtName, HAZARD_TYPE_LABELS, type District } from '@repo/types';

import { createWarning, describeWarningError, issueDraft, previewWarning } from '../api/hazardWarnings';
import { LevelChip } from '../components/warnings/LevelChip';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Skeleton } from '../components/ui/Skeleton';
import { config } from '../config';
import { usePageTitle } from '../hooks/usePageTitle';
import { useResource } from '../hooks/useResource';
import { useWarningStats } from '../hooks/useWarningStats';
import { formatIncidentTime } from '../lib/format';
import { editWarningPath, NEW_WARNING_PATH, warningPath, WARNINGS_PATH } from '../lib/routes';
import { toFields, type WarningReviewState } from '../lib/warningForm';

const count = new Intl.NumberFormat('en-GB');

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/** Screen 2. Opening it without a form (a refresh or a typed URL) goes back to screen 1. */
export function ReviewWarningPage() {
  const location = useLocation();
  const state = location.state as WarningReviewState | null;
  usePageTitle('Review warning');

  if (!state?.form) return <Navigate to={NEW_WARNING_PATH} replace />;
  return <ReviewWarning state={state} />;
}

function ReviewWarning({ state }: { state: WarningReviewState }) {
  const { form, clientRequestId, draftId } = state;
  const navigate = useNavigate();
  const { refresh } = useWarningStats();
  const fields = useMemo(() => toFields(form), [form]);
  const preview = useResource((signal) => previewWarning(fields, signal), [fields]);
  const [issueAnyway, setIssueAnyway] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const duplicates = preview.data?.duplicates ?? [];
  const recipients = preview.data?.recipients;
  const blocked = !preview.data || (duplicates.length > 0 && !issueAnyway);
  const areaText = fields.districts.map(districtName).join(', ');

  function back() {
    navigate(draftId ? editWarningPath(draftId) : NEW_WARNING_PATH, { state: { form, clientRequestId } });
  }

  async function issue() {
    setSending(true);
    setFailure(null);
    const force = duplicates.length > 0 && issueAnyway;
    try {
      const issued = draftId
        ? await issueDraft(draftId, { force })
        : await createWarning({ ...fields, clientRequestId, action: 'ISSUE', force });
      refresh();
      navigate(warningPath(issued.id), { replace: true, state: { notice: `Warning ${issued.reference} issued.` } });
    } catch (error) {
      // Nothing is lost: the summary stays and the officer can confirm again.
      setConfirming(false);
      setFailure(error);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Review Warning</h1>

      {failure !== null && <Banner tone="danger">{describeWarningError(failure)}</Banner>}
      {preview.error !== null && !preview.data && (
        <Banner tone="danger" action={<Button variant="ghost" onClick={preview.reload}>Retry</Button>}>
          {describeWarningError(preview.error)}
        </Banner>
      )}
      {recipients?.total === 0 && (
        <Banner tone="warning">
          <p className="font-semibold">No registered recipients found for the selected area.</p>
          <p>Sirens will still sound in these districts. Go back to change the area, or confirm to issue anyway.</p>
        </Banner>
      )}
      {duplicates.length > 0 && (
        <Banner tone="warning">
          <p>
            An active warning already covers this hazard and area:{' '}
            {duplicates.map((duplicate, index) => (
              <span key={duplicate.id}>
                {index > 0 && ', '}
                <Link to={warningPath(duplicate.id)} className="font-semibold underline">
                  {duplicate.reference}
                </Link>
              </span>
            ))}
            . Cancel that one, or issue this as a separate warning.
          </p>
          <label className="mt-2 flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={issueAnyway} onChange={(event) => setIssueAnyway(event.target.checked)} />
            Issue anyway: this is a different situation
          </label>
        </Banner>
      )}

      <Card title="Warning Summary">
        <div className="grid gap-6 md:grid-cols-2">
          <dl className="space-y-3">
            <Item label="Hazard type">{HAZARD_TYPE_LABELS[fields.hazardType]}</Item>
            <Item label="Warning level">
              <LevelChip level={fields.level} />
            </Item>
            <Item label="Affected area">{areaText}</Item>
            <Item label="Issued by">{config.officerName}</Item>
            <Item label="Valid">
              {fields.validFrom ? formatIncidentTime(fields.validFrom) : 'From issue'} to{' '}
              {fields.validUntil && formatIncidentTime(fields.validUntil)}
            </Item>
          </dl>
          <div className="space-y-3">
            <Item label="Description">{fields.description}</Item>
            {fields.additionalInfo && <Item label="Additional information">{fields.additionalInfo}</Item>}
            <div>
              <p className="text-muted text-xs">Safety instructions</p>
              <ol className="list-decimal pl-5 text-sm">
                {fields.safetyInstructions?.map((row) => <li key={row}>{row}</li>)}
              </ol>
            </div>
            <div className="bg-orange-tint rounded-lg p-4">
              <p className="text-muted text-xs">Total citizens in area</p>
              {recipients ? (
                <>
                  <p className="text-orange text-3xl font-semibold">{count.format(recipients.total)}</p>
                  <ul className="text-muted mt-1 text-xs">
                    {Object.entries(recipients.byDistrict).map(([district, n]) => (
                      <li key={district}>
                        {districtName(district as District)}: {count.format(n ?? 0)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted mt-1 text-xs">{count.format(recipients.withPhone)} can also receive SMS.</p>
                </>
              ) : (
                <Skeleton className="mt-1 h-9 w-24" />
              )}
            </div>
          </div>
        </div>
      </Card>

      <p className="flex items-center justify-center gap-2 text-sm font-semibold">
        <AlertTriangle aria-hidden="true" className="text-orange size-4" />
        Are you sure you want to issue this warning?
      </p>
      <div className="flex justify-center gap-3">
        <Button variant="ghost" onClick={back} disabled={sending}>
          Back
        </Button>
        <Button variant="ghost" className="text-danger" onClick={() => setDiscarding(true)} disabled={sending}>
          Cancel
        </Button>
        <Button onClick={() => setConfirming(true)} disabled={blocked}>
          Confirm Warning
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Issue this warning?"
        confirmLabel="Issue warning"
        confirmVariant="primary"
        loading={sending}
        onConfirm={issue}
        onCancel={() => setConfirming(false)}
      >
        It will be sent to {count.format(recipients?.total ?? 0)} registered citizens in {areaText} by push notification,
        SMS and audible alert. A sent warning cannot be recalled, only cancelled with an All Clear.
      </ConfirmDialog>
      <ConfirmDialog
        open={discarding}
        title="Discard this warning?"
        confirmLabel="Discard"
        onConfirm={() => navigate(WARNINGS_PATH)}
        onCancel={() => setDiscarding(false)}
      >
        Nothing has been sent. {draftId ? 'The saved draft is kept.' : 'What you entered will be lost.'}
      </ConfirmDialog>
    </div>
  );
}
```

Add the route `warnings/review` and the `ReviewWarningPage` import to `App.tsx`.

`Banner` takes `children: ReactNode` in the web app, so paragraphs inside it are fine.

Run: `cd apps/web && bunx vitest run src/pages/ReviewWarningPage.test.tsx`
Expected: PASS.

- [ ] **Step 3: Gate and commit**

Run: `cd apps/web && bun run check-types && bun run lint`
Expected: PASS.

```bash
git add apps/web
git commit -m "feat(web): add the warning review step with recipient count and duplicate check"
```

---
### Task 11: Portal screen 3 (Dissemination Status), Warnings list, and escalate from a verified report

**Files:**
- Create: `apps/web/src/components/warnings/ChannelCard.tsx`, `apps/web/src/components/warnings/DeliveryActivity.tsx`
- Create: `apps/web/src/pages/WarningStatusPage.tsx`, `apps/web/src/pages/WarningStatusPage.test.tsx`
- Create: `apps/web/src/pages/WarningsListPage.tsx`, `apps/web/src/pages/WarningsListPage.test.tsx`
- Modify: `apps/web/src/pages/ReviewReportPage.tsx`, `apps/web/src/pages/ReviewReportPage.test.tsx`, `apps/web/src/App.tsx`, `apps/web/src/lib/format.ts` (+ `formatClock`)

**Interfaces:**
- Consumes: Task 8 API and chips, `warningPath`, `editWarningPath`, `NEW_WARNING_PATH`, `WARNINGS_PATH` (Task 9), `Pagination` with `noun`.
- Produces: routes `/warnings` and `/warnings/:id`; `ChannelCard({ status, onRetry?, retrying? })`; `DeliveryActivity({ logs })`; `formatClock(iso): string` ("14:31").

- [ ] **Step 1: Write failing status-page tests** — `pages/WarningStatusPage.test.tsx`

```tsx
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStats } from '../api/hazardReports';
import { cancelWarning, getWarning, retryWarning } from '../api/hazardWarnings';
import { ApiError } from '../api/client';
import { NOW, stats, warning, warningDetail } from '../test/fixtures';
import { renderPage } from '../test/render';
import { WarningStatusPage } from './WarningStatusPage';

vi.mock('../api/hazardReports', () => ({ getStats: vi.fn() }));
vi.mock('../api/hazardWarnings', async () => {
  const actual = await vi.importActual<typeof import('../api/hazardWarnings')>('../api/hazardWarnings');
  return { ...actual, getWarning: vi.fn(), retryWarning: vi.fn(), cancelWarning: vi.fn() };
});

const ID = '6700aa77bcf86cd799439011';
const partial = warningDetail({
  status: 'PARTIALLY_DISSEMINATED',
  channels: [
    { channel: 'PUSH', state: 'SENT', recipients: 10, delivered: 10, attempts: 1 },
    { channel: 'SMS', state: 'FAILED', recipients: 0, delivered: 0, attempts: 1, lastError: 'SMS gateway is unavailable' },
    { channel: 'AUDIBLE', state: 'SENT', recipients: 1, delivered: 1, attempts: 1 },
  ],
});

function renderStatus(state?: unknown) {
  return renderPage(<WarningStatusPage />, { at: { pathname: `/warnings/${ID}`, state }, path: '/warnings/:id' });
}

describe('WarningStatusPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(getStats).mockResolvedValue(stats);
    vi.mocked(getWarning).mockReset().mockResolvedValue(warningDetail());
    vi.mocked(retryWarning).mockReset().mockResolvedValue(warning());
    vi.mocked(cancelWarning).mockReset().mockResolvedValue(warning({ status: 'CANCELLED' }));
  });

  it('shows the three channel cards, activity and overview', async () => {
    renderStatus({ notice: 'Warning HW-2026-0007 issued.' });

    expect(await screen.findByRole('heading', { name: 'Dissemination Status' })).toBeInTheDocument();
    expect(screen.getByText('Warning HW-2026-0007 issued.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Push Notification' })).toHaveTextContent('1,245');
    expect(screen.getByRole('region', { name: 'SMS' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Audible Alert' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Live Delivery Activity' })).toHaveTextContent('Push notification delivered to 1245 citizens');
    expect(screen.getByRole('region', { name: 'Warning Overview' })).toHaveTextContent('312');
    expect(screen.getByText('3 of 3 channels finished')).toBeInTheDocument();
  });

  it('flags a partial dissemination and retries the failed channel', async () => {
    vi.mocked(getWarning).mockResolvedValueOnce(partial).mockResolvedValue(warningDetail());
    renderStatus();

    expect(await screen.findByText(/Some channels could not deliver this warning/)).toBeInTheDocument();
    const sms = screen.getByRole('region', { name: 'SMS' });
    expect(sms).toHaveTextContent('SMS gateway is unavailable');

    await userEvent.click(within(sms).getByRole('button', { name: 'Retry SMS' }));

    expect(retryWarning).toHaveBeenCalledWith(ID);
    await waitFor(() => expect(screen.queryByText(/Some channels could not deliver/)).not.toBeInTheDocument());
  });

  it('explains pending dissemination', async () => {
    vi.mocked(getWarning).mockResolvedValue({ ...partial, status: 'PENDING_DISSEMINATION' });
    renderStatus();
    expect(await screen.findByText(/Notification service is temporarily unavailable/)).toBeInTheDocument();
  });

  it('needs a reason to cancel, then shows the All Clear', async () => {
    vi.mocked(getWarning)
      .mockResolvedValueOnce(warningDetail())
      .mockResolvedValue(
        warningDetail({
          status: 'CANCELLED',
          active: false,
          cancellation: { cancelledAt: NOW.toISOString(), cancelledBy: 'Officer Silva', reason: 'Water has receded' },
        }),
      );
    renderStatus();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel Warning' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel this warning?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send All Clear' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Give a reason of at least 5 characters.');
    expect(cancelWarning).not.toHaveBeenCalled();

    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Water has receded');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send All Clear' }));

    await waitFor(() => expect(cancelWarning).toHaveBeenCalledWith(ID, { reason: 'Water has receded' }));
    expect(await screen.findByText(/Cancelled by Officer Silva/)).toHaveTextContent('Water has receded');
    expect(screen.queryByRole('button', { name: 'Cancel Warning' })).not.toBeInTheDocument();
  });

  it('shows the current state when another officer acted first', async () => {
    vi.mocked(retryWarning).mockRejectedValue(new ApiError(409, 'There is nothing to retry for this warning'));
    vi.mocked(getWarning).mockResolvedValue(partial);
    renderStatus();

    await userEvent.click(await screen.findByRole('button', { name: 'Retry SMS' }));
    expect(await screen.findByText('There is nothing to retry for this warning')).toBeInTheDocument();
  });

  it('polls while the warning is still being sent', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(getWarning).mockResolvedValue({ ...warningDetail(), status: 'DISSEMINATING' });
    renderStatus();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const calls = vi.mocked(getWarning).mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(vi.mocked(getWarning).mock.calls.length).toBeGreaterThan(calls);
    vi.useRealTimers();
  });

  it('points a draft to its editor and says when a warning expired', async () => {
    vi.mocked(getWarning).mockResolvedValueOnce({ ...warningDetail(), status: 'DRAFT', active: false, channels: [] });
    const { unmount } = renderStatus();
    expect(await screen.findByRole('link', { name: 'Edit draft' })).toHaveAttribute('href', `/warnings/${ID}/edit`);
    unmount();

    vi.mocked(getWarning).mockResolvedValueOnce({ ...warningDetail(), active: false });
    renderStatus();
    expect(await screen.findByText(/This warning expired/)).toBeInTheDocument();
  });

  it('shows not found', async () => {
    vi.mocked(getWarning).mockRejectedValue(new ApiError(404, 'Warning not found'));
    renderStatus();
    expect(await screen.findByText('This warning could not be found.')).toBeInTheDocument();
  });
});
```

Run: `cd apps/web && bunx vitest run src/pages/WarningStatusPage.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 2: Implement the pieces**

Append to `lib/format.ts`:

```ts
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false });

/** "14:31" in Sri Lanka time, for activity feeds. */
export function formatClock(iso: string): string {
  return clock.format(new Date(iso));
}
```

`components/warnings/ChannelCard.tsx`:

```tsx
import { Bell, MessageSquare, RotateCw, Siren, type LucideIcon } from 'lucide-react';

import { CHANNEL_LABELS, type ChannelKind, type ChannelState, type DisseminationStatusDto } from '@repo/types';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const ICONS: Record<ChannelKind, LucideIcon> = { PUSH: Bell, SMS: MessageSquare, AUDIBLE: Siren };
const STATE_TEXT: Record<ChannelState, { label: string; classes: string }> = {
  PENDING: { label: 'Sending…', classes: 'text-warning-text' },
  SENT: { label: 'Completed', classes: 'text-success' },
  FAILED: { label: 'Failed', classes: 'text-danger' },
  SKIPPED: { label: 'No recipients', classes: 'text-muted' },
};
const count = new Intl.NumberFormat('en-GB');

interface ChannelCardProps {
  status: DisseminationStatusDto;
  onRetry?: () => void;
  retrying?: boolean;
}

/** One channel's progress, as on the wireframe's three cards, with Retry when it failed. */
export function ChannelCard({ status, onRetry, retrying = false }: ChannelCardProps) {
  const Icon = ICONS[status.channel];
  const label = CHANNEL_LABELS[status.channel];
  const state = STATE_TEXT[status.state];
  const percent = status.recipients === 0 ? 0 : Math.round((status.delivered / status.recipients) * 100);

  return (
    <Card title={label}>
      <div className="flex items-center justify-between">
        <Icon aria-hidden="true" className="text-muted size-5" />
        <span className={`text-xs font-semibold ${state.classes}`}>● {state.label}</span>
      </div>
      <div className="mt-3 flex justify-between text-sm">
        <span className="text-muted">{status.channel === 'AUDIBLE' ? 'Districts' : 'Citizens'}</span>
        <span className="font-semibold">{count.format(status.recipients)}</span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} delivered`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="bg-neutral-tint mt-2 h-1.5 overflow-hidden rounded-full"
      >
        <div className="bg-success h-full" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-success mt-2 text-xs font-semibold">Delivered: {count.format(status.delivered)}</p>
      {status.attempts > 1 && <p className="text-muted text-xs">Attempts: {status.attempts}</p>}
      {status.lastError && status.state === 'FAILED' && <p className="text-danger mt-1 text-xs">{status.lastError}</p>}
      {status.state === 'FAILED' && onRetry && (
        <Button
          variant="ghost"
          className="mt-3 w-full"
          loading={retrying}
          icon={<RotateCw aria-hidden="true" className="size-4" />}
          onClick={onRetry}
          aria-label={`Retry ${label}`}
        >
          Retry
        </Button>
      )}
    </Card>
  );
}
```

(The accessible names are "Retry Push Notification", "Retry SMS", "Retry Audible Alert".)

`components/warnings/DeliveryActivity.tsx`:

```tsx
import type { NotificationLogDto } from '@repo/types';

import { formatClock } from '../../lib/format';

/** Newest first, a dot coloured by outcome (green sent, red failed). */
export function DeliveryActivity({ logs }: { logs: NotificationLogDto[] }) {
  if (logs.length === 0) return <p className="text-muted text-sm">No delivery activity yet.</p>;
  return (
    <ol className="space-y-2">
      {logs.map((log) => (
        <li key={log.id} className="flex gap-2 text-sm">
          <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${log.outcome === 'SENT' ? 'bg-success' : 'bg-danger'}`} />
          <span className="text-muted font-mono text-xs leading-5">{formatClock(log.createdAt)}</span>
          <span>
            <span className="sr-only">{log.outcome === 'SENT' ? 'Sent: ' : 'Failed: '}</span>
            {log.message}
          </span>
        </li>
      ))}
    </ol>
  );
}
```

`pages/WarningStatusPage.tsx`:

```tsx
import { ArrowLeft, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import {
  districtName,
  HAZARD_TYPE_LABELS,
  WARNING_LIMITS,
  type HazardWarningDetailDto,
} from '@repo/types';

import { ApiError } from '../api/client';
import { cancelWarning, describeWarningError, getWarning, retryWarning } from '../api/hazardWarnings';
import { ChannelCard } from '../components/warnings/ChannelCard';
import { DeliveryActivity } from '../components/warnings/DeliveryActivity';
import { LevelChip } from '../components/warnings/LevelChip';
import { WarningStatusChip } from '../components/warnings/WarningStatusChip';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, INPUT_CLASSES } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';
import { useResource } from '../hooks/useResource';
import { useWarningStats } from '../hooks/useWarningStats';
import { formatIncidentTime } from '../lib/format';
import { editWarningPath, WARNINGS_PATH } from '../lib/routes';

export const POLL_MS = 3000;
const ISSUED = ['DISSEMINATING', 'DISSEMINATED', 'PARTIALLY_DISSEMINATED', 'PENDING_DISSEMINATION'];
const count = new Intl.NumberFormat('en-GB');

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

/** Screen 3: per-channel delivery, Retry for failures, and Cancel with an All Clear. */
export function WarningStatusPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const { data: warning, error, loading, reload } = useResource((signal) => getWarning(id, signal), [id]);
  usePageTitle(warning ? `Warning ${warning.reference}` : 'Warning');

  // While the server is still sending, check again every few seconds.
  useEffect(() => {
    if (warning?.status !== 'DISSEMINATING') return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [warning?.status, reload]);

  if (loading && !warning) {
    return (
      <div role="status" aria-label="Loading warning" className="space-y-4">
        <Skeleton className="h-16" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }
  if (!warning) {
    const missing = error instanceof ApiError && error.status === 404;
    return missing ? (
      <EmptyState
        icon={<SearchX className="size-10" />}
        title="This warning could not be found."
        action={<Link to={WARNINGS_PATH} className="text-orange font-semibold">Back to warnings</Link>}
      />
    ) : (
      <Banner tone="danger" action={<Button variant="ghost" onClick={reload}>Retry</Button>}>
        {describeWarningError(error)}
      </Banner>
    );
  }
  return <WarningStatus warning={warning} notice={notice} reload={reload} />;
}

function WarningStatus({ warning, notice, reload }: { warning: HazardWarningDetailDto; notice?: string; reload: () => void }) {
  const { refresh } = useWarningStats();
  const [retrying, setRetrying] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [cancelling, setCancelling] = useState(false);

  const issued = ISSUED.includes(warning.status);
  const expired = issued && !warning.active;
  const finished = warning.channels.filter((channel) => channel.state !== 'PENDING').length;
  const push = warning.channels.find((channel) => channel.channel === 'PUSH');

  async function retry() {
    setRetrying(true);
    setFailure(null);
    try {
      await retryWarning(warning.id);
    } catch (error) {
      setFailure(error);
    } finally {
      setRetrying(false);
      reload();
      refresh();
    }
  }

  async function cancel() {
    if (reason.trim().length < WARNING_LIMITS.cancelReasonMin) {
      setReasonError(`Give a reason of at least ${WARNING_LIMITS.cancelReasonMin} characters.`);
      return;
    }
    setCancelling(true);
    setFailure(null);
    try {
      await cancelWarning(warning.id, { reason: reason.trim() });
      setCancelOpen(false);
    } catch (error) {
      setCancelOpen(false);
      setFailure(error);
    } finally {
      setCancelling(false);
      reload();
      refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to={WARNINGS_PATH} className="text-muted hover:text-ink inline-flex items-center gap-1 text-sm">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to warnings
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Dissemination Status</h1>
          <LevelChip level={warning.level} />
          <WarningStatusChip warning={warning} />
        </div>
        <p className="text-muted text-sm">
          <span className="font-mono">{warning.reference}</span> · {HAZARD_TYPE_LABELS[warning.hazardType]} ·{' '}
          {warning.districts.map(districtName).join(', ')}
        </p>
      </div>

      {notice && <Banner tone="success">{notice}</Banner>}
      {failure !== null && <Banner tone="danger">{describeWarningError(failure)}</Banner>}
      {warning.status === 'PARTIALLY_DISSEMINATED' && (
        <Banner tone="warning">Some channels could not deliver this warning. Retry them below, or use radio or TV as a backup.</Banner>
      )}
      {warning.status === 'PENDING_DISSEMINATION' && (
        <Banner tone="danger">
          Notification service is temporarily unavailable. The warning is saved; retry each channel when the service is back.
        </Banner>
      )}
      {warning.status === 'DRAFT' && (
        <Banner tone="warning" action={<Link to={editWarningPath(warning.id)} className="font-semibold underline">Edit draft</Link>}>
          This warning is a draft and has not been sent.
        </Banner>
      )}
      {warning.cancellation && (
        <Banner tone="success">
          Cancelled by {warning.cancellation.cancelledBy} on {formatIncidentTime(warning.cancellation.cancelledAt)}: {warning.cancellation.reason}. An All
          Clear was sent to the same districts.
        </Banner>
      )}
      {expired && warning.validUntil && <Banner tone="warning">This warning expired on {formatIncidentTime(warning.validUntil)}.</Banner>}

      {warning.channels.length > 0 && (
        <>
          <Card title="Dissemination Progress">
            <div className="flex items-center justify-between text-sm">
              <span>{finished} of {warning.channels.length} channels finished</span>
            </div>
            <div className="bg-neutral-tint mt-2 h-2 overflow-hidden rounded-full">
              <div className="bg-orange h-full" style={{ width: `${(finished / warning.channels.length) * 100}%` }} />
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            {warning.channels.map((channel) => (
              <ChannelCard
                key={channel.channel}
                status={channel}
                retrying={retrying}
                onRetry={issued && warning.status !== 'DISSEMINATING' ? retry : undefined}
              />
            ))}
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="Live Delivery Activity">
          <DeliveryActivity logs={warning.logs} />
        </Card>
        <Card title="Warning Overview">
          <dl className="space-y-2">
            <Row label="Warning level"><LevelChip level={warning.level} /></Row>
            <Row label="Hazard type">{HAZARD_TYPE_LABELS[warning.hazardType]}</Row>
            <Row label="Affected area">{warning.districts.map(districtName).join(', ')}</Row>
            <Row label="Total recipients">{count.format(push?.recipients ?? 0)}</Row>
            <Row label="Acknowledged">{count.format(warning.acknowledged)}</Row>
            {warning.issuedAt && <Row label="Started">{formatIncidentTime(warning.issuedAt)}</Row>}
            {warning.validUntil && <Row label="Valid until">{formatIncidentTime(warning.validUntil)}</Row>}
            {warning.issuedBy && <Row label="Issued by">{warning.issuedBy}</Row>}
            {warning.sourceReportId && (
              <Row label="From report">
                <Link to={`/reports/${warning.sourceReportId}`} className="text-orange underline">View report</Link>
              </Row>
            )}
          </dl>
          {issued && (
            <Button variant="danger" className="mt-4 w-full" onClick={() => setCancelOpen(true)}>
              Cancel Warning
            </Button>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this warning?"
        confirmLabel="Send All Clear"
        loading={cancelling}
        onConfirm={cancel}
        onCancel={() => setCancelOpen(false)}
      >
        <p>Citizens in {warning.districts.map(districtName).join(', ')} will get an All Clear and the warning will leave their phones.</p>
        <div className="mt-3">
          <Field label="Reason" htmlFor="cancel-reason" required error={reasonError} hint="Shown to citizens with the All Clear.">
            <textarea
              id="cancel-reason"
              rows={3}
              maxLength={WARNING_LIMITS.cancelReasonMax}
              className={INPUT_CLASSES}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError(undefined);
              }}
            />
          </Field>
        </div>
      </ConfirmDialog>
    </div>
  );
}
```

Note: `Cancel Warning` is shown for every issued status, including an expired one, so an officer can still send the All Clear.

Run: `cd apps/web && bunx vitest run src/pages/WarningStatusPage.test.tsx`
Expected: PASS. If the "points a draft" test finds two warnings rendered, check that `unmount()` ran before the second render.

- [ ] **Step 3: Write failing list tests** — `pages/WarningsListPage.test.tsx`

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStats } from '../api/hazardReports';
import { listWarnings } from '../api/hazardWarnings';
import { stats, warning } from '../test/fixtures';
import { renderPage } from '../test/render';
import { WarningsListPage } from './WarningsListPage';

vi.mock('../api/hazardReports', () => ({ getStats: vi.fn() }));
vi.mock('../api/hazardWarnings', async () => {
  const actual = await vi.importActual<typeof import('../api/hazardWarnings')>('../api/hazardWarnings');
  return { ...actual, listWarnings: vi.fn() };
});

const page = (items = [warning()], total = items.length) => ({ items, total, page: 1, limit: 20 });

describe('WarningsListPage', () => {
  beforeEach(() => {
    vi.mocked(getStats).mockResolvedValue(stats);
    vi.mocked(listWarnings).mockReset().mockResolvedValue(page());
  });

  it('lists active warnings with a link to their status', async () => {
    renderPage(<WarningsListPage />, { at: '/warnings', path: '/warnings' });

    expect(await screen.findByRole('link', { name: 'View HW-2026-0007' })).toHaveAttribute('href', '/warnings/6700aa77bcf86cd799439011');
    expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true');
    expect(listWarnings).toHaveBeenCalledWith({ view: 'active', page: 1, limit: 20 }, expect.any(AbortSignal));
  });

  it('switches to drafts and links each to its editor', async () => {
    vi.mocked(listWarnings).mockResolvedValue(page([warning({ status: 'DRAFT', active: false })]));
    renderPage(<WarningsListPage />, { at: '/warnings', path: '/warnings' });

    await userEvent.click(await screen.findByRole('tab', { name: 'Drafts' }));

    expect(await screen.findByRole('link', { name: 'Edit HW-2026-0007' })).toHaveAttribute('href', '/warnings/6700aa77bcf86cd799439011/edit');
    expect(listWarnings).toHaveBeenLastCalledWith({ view: 'drafts', page: 1, limit: 20 }, expect.any(AbortSignal));
  });

  it('shows the notice it was opened with', async () => {
    renderPage(<WarningsListPage />, { at: { pathname: '/warnings', search: '?view=drafts', state: { notice: 'Draft HW-2026-0008 saved.' } }, path: '/warnings' });
    expect(await screen.findByText('Draft HW-2026-0008 saved.')).toBeInTheDocument();
  });

  it('says when there is nothing to show', async () => {
    vi.mocked(listWarnings).mockResolvedValue(page([]));
    renderPage(<WarningsListPage />, { at: '/warnings', path: '/warnings' });
    expect(await screen.findByText('No active warnings')).toBeInTheDocument();
  });

  it('offers a retry when loading fails', async () => {
    vi.mocked(listWarnings).mockRejectedValueOnce(new Error('down')).mockResolvedValue(page());
    renderPage(<WarningsListPage />, { at: '/warnings', path: '/warnings' });

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('link', { name: 'View HW-2026-0007' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Implement `pages/WarningsListPage.tsx`**

```tsx
import { Megaphone, TriangleAlert } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import { districtName, HAZARD_TYPE_LABELS, type HazardWarningDto, type WarningView } from '@repo/types';

import { describeWarningError, listWarnings } from '../api/hazardWarnings';
import { Pagination } from '../components/reports/Pagination';
import { LevelChip } from '../components/warnings/LevelChip';
import { WarningStatusChip } from '../components/warnings/WarningStatusChip';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';
import { useResource } from '../hooks/useResource';
import { formatIncidentTime } from '../lib/format';
import { editWarningPath, NEW_WARNING_PATH, warningPath } from '../lib/routes';

const PAGE_SIZE = 20;
const VIEWS: { view: WarningView; label: string; empty: string; when: (w: HazardWarningDto) => string | undefined }[] = [
  { view: 'active', label: 'Active', empty: 'No active warnings', when: (w) => w.issuedAt },
  { view: 'drafts', label: 'Drafts', empty: 'No drafts', when: (w) => w.updatedAt },
  { view: 'past', label: 'Past', empty: 'No past warnings', when: (w) => w.cancellation?.cancelledAt ?? w.validUntil },
];
const WHEN_HEADER: Record<WarningView, string> = { active: 'Issued', drafts: 'Last edited', past: 'Ended' };

function readView(value: string | null): WarningView {
  return VIEWS.some((item) => item.view === value) ? (value as WarningView) : 'active';
}

export function WarningsListPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const view = readView(params.get('view'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const current = VIEWS.find((item) => item.view === view)!;
  const { data, error, loading, reload } = useResource((signal) => listWarnings({ view, page, limit: PAGE_SIZE }, signal), [view, page]);
  usePageTitle('Hazard warnings');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Hazard Warnings</h1>
        <Link to={NEW_WARNING_PATH} className="bg-orange inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white">
          <Megaphone aria-hidden="true" className="size-4" />
          Issue Warning
        </Link>
      </div>
      {notice && <Banner tone="success">{notice}</Banner>}

      <div role="tablist" aria-label="Warning views" className="border-border flex gap-1 border-b">
        {VIEWS.map((item) => (
          <button
            key={item.view}
            type="button"
            role="tab"
            aria-selected={item.view === view}
            onClick={() => setParams({ view: item.view })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${item.view === view ? 'border-orange text-ink' : 'text-muted border-transparent'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card>
        <div role="tabpanel" aria-label={`${current.label} warnings`}>
          {loading && !data ? (
            <div role="status" aria-label="Loading warnings" className="space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : !data ? (
            <Banner tone="danger" action={<Button variant="ghost" onClick={reload}>Retry</Button>}>
              {describeWarningError(error)}
            </Banner>
          ) : data.items.length === 0 ? (
            <EmptyState icon={<TriangleAlert className="size-10" />} title={current.empty} />
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-muted text-xs uppercase">
                    <tr>
                      <th className="py-2 pr-4">Reference</th>
                      <th className="py-2 pr-4">Hazard</th>
                      <th className="py-2 pr-4">Level</th>
                      <th className="py-2 pr-4">Districts</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">{WHEN_HEADER[view]}</th>
                      <th className="py-2"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {data.items.map((item) => {
                      const when = current.when(item);
                      const draft = item.status === 'DRAFT';
                      return (
                        <tr key={item.id}>
                          <td className="py-3 pr-4 font-mono">{item.reference}</td>
                          <td className="py-3 pr-4">{HAZARD_TYPE_LABELS[item.hazardType]}</td>
                          <td className="py-3 pr-4"><LevelChip level={item.level} /></td>
                          <td className="py-3 pr-4">{item.districts.map(districtName).join(', ')}</td>
                          <td className="py-3 pr-4"><WarningStatusChip warning={item} /></td>
                          <td className="text-muted py-3 pr-4">{when ? formatIncidentTime(when) : '—'}</td>
                          <td className="py-3 text-right">
                            <Link
                              to={draft ? editWarningPath(item.id) : warningPath(item.id)}
                              aria-label={`${draft ? 'Edit' : 'View'} ${item.reference}`}
                              className="text-orange font-semibold"
                            >
                              {draft ? 'Edit' : 'View'}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={data.page}
                limit={data.limit}
                total={data.total}
                noun="warnings"
                onChange={(next) => setParams({ view, page: String(next) })}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
```

Run: `cd apps/web && bunx vitest run src/pages/WarningsListPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Escalate from a verified report** (finding UC2)

In `ReviewReportPage.tsx`, add `import { Megaphone } from 'lucide-react'` (merge with the existing lucide import) and `NEW_WARNING_PATH` from `../lib/routes`, and after the `{pending && (<Banner ...>)}` block add:

```tsx
      {report.status === 'VERIFIED' && (
        <Banner
          tone="success"
          action={
            <Link
              to={`${NEW_WARNING_PATH}?fromReport=${encodeURIComponent(report.id)}`}
              className="bg-orange inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
            >
              <Megaphone aria-hidden="true" className="size-4" />
              Issue Warning from this report
            </Link>
          }
        >
          This report is verified. If citizens need to act, issue a warning for the area.
        </Banner>
      )}
```

Append to `ReviewReportPage.test.tsx`:

```tsx
  it('offers to issue a warning from a verified report only', async () => {
    vi.mocked(getReport).mockResolvedValue(decidedReport('VERIFIED'));
    renderReview();

    expect(await screen.findByRole('link', { name: 'Issue Warning from this report' })).toHaveAttribute(
      'href',
      `/warnings/new?fromReport=${ID}`,
    );
  });

  it('does not offer a warning for a rejected report', async () => {
    vi.mocked(getReport).mockResolvedValue(decidedReport('REJECTED'));
    renderReview();

    await screen.findByRole('heading', { name: 'Review Hazard Report' });
    expect(screen.queryByRole('link', { name: 'Issue Warning from this report' })).not.toBeInTheDocument();
  });
```

- [ ] **Step 6: Routes, full web gate, commit**

Add the `warnings` and `warnings/:id` routes plus imports to `App.tsx` (the full block is in Task 9 Step 7). Add a case to `App.test.tsx` that `/warnings/new` renders "Issue Hazard Warning" (mock `DistrictMap` there the same way as in `WarningFormPage.test.tsx`).

Run: `cd apps/web && bun run test:cov && bun run check-types && bun run lint`
Expected: all PASS, coverage above 80% on every metric (target 90%+ for `pages/Warning*`, `components/warnings`, `lib/warning*`).

```bash
git add apps/web
git commit -m "feat(web): add dissemination status, warnings list and escalate from report"
```

---
### Task 12: Citizen app data: JSON requests, alerts API, AlertsProvider, Profile (alert area)

**Files:**
- Modify: `apps/mobile/src/api/client.ts`, `apps/mobile/src/api/client.test.ts`, `apps/mobile/src/lib/time.ts`, `apps/mobile/src/theme.ts`, `apps/mobile/App.tsx`, `apps/mobile/src/test/utils.tsx`
- Create: `apps/mobile/src/test/fixtures.ts`, `apps/mobile/src/api/alerts.ts`, `apps/mobile/src/api/alerts.test.ts`, `apps/mobile/src/lib/alerts.ts`, `apps/mobile/src/lib/alerts.test.ts`, `apps/mobile/src/context/AlertsContext.tsx`, `apps/mobile/src/context/AlertsContext.test.tsx`
- Create: `apps/mobile/src/screens/ProfileScreen.tsx`, `apps/mobile/src/screens/profile.test.tsx`
- Modify: `apps/mobile/src/navigation/MainTabs.tsx` (Profile tab)

**Interfaces:**
- Consumes: `/api/citizens/me`, `/api/alerts/*` (Task 7); `CitizenAlertDto`, `CitizenProfileDto`, `RegisterCitizenInput`, `DISTRICTS`, `DISTRICT_INFO`, `districtName`, `normalizeSriLankanMobile`, `WARNING_LEVELS`, `HAZARD_TYPE_LABELS` (Task 1).
- Produces:

```ts
// api/client.ts: RequestOptions gains `json?: unknown` and method 'PUT'
// api/alerts.ts
export function getMyProfile(signal?: AbortSignal): Promise<CitizenProfileDto | null>;   // null on 404
export function saveMyProfile(input: RegisterCitizenInput): Promise<CitizenProfileDto>;
export function listMyAlerts(signal?: AbortSignal): Promise<CitizenAlertDto[]>;
export function acknowledgeAlert(id: string): Promise<CitizenAlertDto>;
// lib/alerts.ts
export const ALERTS_POLL_MS = 30_000; export const ALERTS_CACHE_KEY = 'alerts.cache'; export const PROFILE_CACHE_KEY = 'citizen.profile';
export function activeAlerts(alerts): CitizenAlertDto[]; export function unacknowledged(alerts): CitizenAlertDto[];
export function highestLevel(alerts): WarningLevel | null; export function alertTitle(alert): string;
export function describeAlertDistricts(alert): string; export function mapsUrl(district: District): string;
export function formatLocalMobile(phone: string): string;  // "+94771234567" -> "077 123 4567"
// lib/time.ts
export function formatDateTime(iso: string): string;  // "7 Oct 2026, 14:30"
// theme.ts
export const levelColors: Record<WarningLevel, { background: string; text: string }>;
// context/AlertsContext.tsx
export interface AlertsSource { getProfile(): Promise<CitizenProfileDto | null>; saveProfile(input: RegisterCitizenInput): Promise<CitizenProfileDto>; listAlerts(): Promise<CitizenAlertDto[]>; acknowledge(id: string): Promise<CitizenAlertDto> }
export const apiAlertsSource: AlertsSource;
export interface AlertsValue { alerts: CitizenAlertDto[]; profile: CitizenProfileDto | null; profileLoaded: boolean; stale: boolean; refresh(): Promise<void>; acknowledge(id: string): Promise<void>; saveProfile(input: RegisterCitizenInput): Promise<void> }
export function AlertsProvider(props: { children: ReactNode; source?: AlertsSource; pollMs?: number }): JSX.Element;
export function useAlerts(): AlertsValue;
// test/utils.tsx
export function stubAlertsSource(overrides?: Partial<AlertsSource>): AlertsSource;
export async function renderApp(queue?: ReportQueue, alerts?: AlertsSource);
```

- [ ] **Step 1: JSON bodies in the client** — failing test first, appended to `api/client.test.ts` (reuse that file's existing fetch mock helper)

```ts
  it('sends a JSON body with its content type', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    global.fetch = fetchMock;

    await request('/api/citizens/me', { method: 'PUT', json: { district: 'KANDY' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.body).toBe('{"district":"KANDY"}');
  });
```

Run: `cd apps/mobile && bunx jest src/api/client.test.ts`
Expected: FAIL (type error / body undefined).

In `api/client.ts`: add `'PUT'` to the `method` union, add `/** Sent as JSON. Use `body` for multipart uploads. */ json?: unknown;` to `RequestOptions`, destructure `json`, and build headers and body as:

```ts
  const headers: Record<string, string> = { 'x-reporter-id': await getReporterId() };
  if (json !== undefined) headers['content-type'] = 'application/json';
  const payloadBody = json !== undefined ? JSON.stringify(json) : body;
```

then pass `body: payloadBody` to `fetch`. Keep the existing multipart comment ("No content-type for multipart…") above the `headers` line.

Run: `cd apps/mobile && bunx jest src/api`
Expected: PASS.

- [ ] **Step 2: Alerts API** — `api/alerts.ts`

```ts
import type { CitizenAlertDto, CitizenProfileDto, RegisterCitizenInput } from '@repo/types';

import { ApiError, request } from './client';

/** The citizen's alert district, or null when it was never set. */
export async function getMyProfile(signal?: AbortSignal): Promise<CitizenProfileDto | null> {
  try {
    const { data } = await request<CitizenProfileDto>('/api/citizens/me', { signal });
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function saveMyProfile(input: RegisterCitizenInput): Promise<CitizenProfileDto> {
  const { data } = await request<CitizenProfileDto>('/api/citizens/me', { method: 'PUT', json: input });
  return data;
}

export async function listMyAlerts(signal?: AbortSignal): Promise<CitizenAlertDto[]> {
  const { data } = await request<CitizenAlertDto[]>('/api/alerts/mine', { signal });
  return data;
}

export async function acknowledgeAlert(id: string): Promise<CitizenAlertDto> {
  const { data } = await request<CitizenAlertDto>(`/api/alerts/${encodeURIComponent(id)}/acknowledge`, { method: 'POST' });
  return data;
}
```

`api/alerts.test.ts`:

```ts
import { ApiError } from './client';
import { acknowledgeAlert, getMyProfile, listMyAlerts, saveMyProfile } from './alerts';

function respond(status: number, body?: unknown) {
  const fetchMock = jest.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  global.fetch = fetchMock;
  return fetchMock;
}

describe('alerts API', () => {
  it('returns null when the district was never set', async () => {
    respond(404, { statusCode: 404, error: 'Not Found', message: 'Set your district to receive warnings' });
    await expect(getMyProfile()).resolves.toBeNull();
  });

  it('passes other failures on', async () => {
    respond(500, { statusCode: 500, error: 'Internal Server Error', message: 'Internal server error' });
    await expect(getMyProfile()).rejects.toBeInstanceOf(ApiError);
  });

  it('saves the profile as JSON and reads alerts', async () => {
    const fetchMock = respond(200, { district: 'KANDY', updatedAt: '2026-10-07T00:00:00Z' });
    await saveMyProfile({ district: 'KANDY' });
    await listMyAlerts();
    await acknowledgeAlert('w 1');

    expect(fetchMock.mock.calls.map(([url, init]) => `${init.method ?? 'GET'} ${url}`)).toEqual([
      'PUT http://localhost:3000/api/citizens/me',
      'GET http://localhost:3000/api/alerts/mine',
      'POST http://localhost:3000/api/alerts/w%201/acknowledge',
    ]);
  });
});
```

Run: `cd apps/mobile && bunx jest src/api/alerts.test.ts`
Expected: PASS. (If the client sends `method: undefined` for GET, the `?? 'GET'` covers it.)

- [ ] **Step 3: Pure helpers, time format, level colours**

Append to `lib/time.ts`:

```ts
/** Always the full date and time, e.g. "7 Oct 2026, 14:30" (Sri Lanka time). */
export function formatDateTime(iso: string): string {
  return absolute.format(new Date(iso)).replace(' at ', ', ');
}
```

Append to `theme.ts`:

```ts
import type { WarningLevel } from '@repo/types';

/** Warning level badges: the portal's level buttons, from the same tokens. */
export const levelColors: Record<WarningLevel, { background: string; text: string }> = {
  CRITICAL: { background: colors.danger, text: colors.white },
  HIGH: { background: colors.orange, text: colors.white },
  MEDIUM: { background: colors.warningTint, text: colors.warningText },
  LOW: { background: colors.success, text: colors.white },
};
```

(Move the `import type` to the top of the file.)

`lib/alerts.ts`:

```ts
import {
  DISTRICT_INFO,
  districtName,
  HAZARD_TYPE_LABELS,
  WARNING_LEVELS,
  type CitizenAlertDto,
  type District,
  type WarningLevel,
} from '@repo/types';

export const ALERTS_POLL_MS = 30_000;
export const ALERTS_CACHE_KEY = 'alerts.cache';
export const PROFILE_CACHE_KEY = 'citizen.profile';

export function activeAlerts(alerts: CitizenAlertDto[]): CitizenAlertDto[] {
  return alerts.filter((alert) => alert.state === 'ACTIVE');
}

/** Active warnings the citizen has not acknowledged: what the bell counts. */
export function unacknowledged(alerts: CitizenAlertDto[]): CitizenAlertDto[] {
  return activeAlerts(alerts).filter((alert) => alert.acknowledgedAt === null);
}

/** The most severe active level, or null when nothing is active. WARNING_LEVELS runs most to least severe. */
export function highestLevel(alerts: CitizenAlertDto[]): WarningLevel | null {
  const levels = activeAlerts(alerts).map((alert) => alert.level);
  return WARNING_LEVELS.find((level) => levels.includes(level)) ?? null;
}

export function alertTitle(alert: CitizenAlertDto): string {
  return `${HAZARD_TYPE_LABELS[alert.hazardType].toUpperCase()} WARNING`;
}

export function describeAlertDistricts(alert: CitizenAlertDto): string {
  return alert.districts.map(districtName).join(', ');
}

/** Opens the phone's maps app (or the browser) at the district centre. */
export function mapsUrl(district: District): string {
  const { latitude, longitude } = DISTRICT_INFO[district];
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** "+94771234567" as a Sri Lankan reads it: "077 123 4567". */
export function formatLocalMobile(phone: string): string {
  const digits = phone.replace(/^\+94/, '0');
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
```

`src/test/fixtures.ts` (new; shared by every mobile alert test):

```ts
import type { CitizenAlertDto } from '@repo/types';

export function alert(overrides: Partial<CitizenAlertDto> = {}): CitizenAlertDto {
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
```

`lib/alerts.test.ts`:

```ts
import { alert } from '../test/fixtures';
import { activeAlerts, alertTitle, describeAlertDistricts, formatLocalMobile, highestLevel, mapsUrl, unacknowledged } from './alerts';
import { formatDateTime } from './time';

describe('alert helpers', () => {
  const list = [
    alert({ id: 'a', level: 'MEDIUM' }),
    alert({ id: 'b', level: 'CRITICAL', acknowledgedAt: '2026-10-07T10:00:00.000Z' }),
    alert({ id: 'c', level: 'CRITICAL', state: 'ALL_CLEAR' }),
  ];

  it('picks active, unacknowledged and the most severe level', () => {
    expect(activeAlerts(list).map((a) => a.id)).toEqual(['a', 'b']);
    expect(unacknowledged(list).map((a) => a.id)).toEqual(['a']);
    expect(highestLevel(list)).toBe('CRITICAL');
    expect(highestLevel([list[2]!])).toBeNull();
  });

  it('formats titles, districts, map links, phones and times', () => {
    expect(alertTitle(alert({ hazardType: 'LANDSLIDE' }))).toBe('LANDSLIDE WARNING');
    expect(describeAlertDistricts(alert({ districts: ['COLOMBO', 'NUWARA_ELIYA'] }))).toBe('Colombo, Nuwara Eliya');
    expect(mapsUrl('COLOMBO')).toBe('https://www.google.com/maps/search/?api=1&query=6.9271,79.8612');
    expect(formatLocalMobile('+94771234567')).toBe('077 123 4567');
    expect(formatDateTime('2026-10-07T09:00:00.000Z')).toBe('7 Oct 2026, 14:30');
  });
});
```

Run: `cd apps/mobile && bunx jest src/lib`
Expected: PASS. (`HAZARD_TYPE_LABELS.LANDSLIDE` is `'Landslide'`; adjust the expectation if the label differs.)

- [ ] **Step 4: AlertsProvider** — `context/AlertsContext.tsx`

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { CitizenAlertDto, CitizenProfileDto, RegisterCitizenInput } from '@repo/types';

import { acknowledgeAlert, getMyProfile, listMyAlerts, saveMyProfile } from '../api/alerts';
import { ALERTS_CACHE_KEY, ALERTS_POLL_MS, PROFILE_CACHE_KEY } from '../lib/alerts';

/** Where alerts come from. The app uses the API; tests pass a stub. */
export interface AlertsSource {
  getProfile(): Promise<CitizenProfileDto | null>;
  saveProfile(input: RegisterCitizenInput): Promise<CitizenProfileDto>;
  listAlerts(): Promise<CitizenAlertDto[]>;
  acknowledge(id: string): Promise<CitizenAlertDto>;
}

export const apiAlertsSource: AlertsSource = {
  getProfile: () => getMyProfile(),
  saveProfile: saveMyProfile,
  listAlerts: () => listMyAlerts(),
  acknowledge: acknowledgeAlert,
};

export interface AlertsValue {
  alerts: CitizenAlertDto[];
  profile: CitizenProfileDto | null;
  /** False until the first answer (or cached copy) arrives, so "set your district" never flashes. */
  profileLoaded: boolean;
  /** The last check failed: what is shown is the saved copy. */
  stale: boolean;
  refresh: () => Promise<void>;
  acknowledge: (id: string) => Promise<void>;
  saveProfile: (input: RegisterCitizenInput) => Promise<void>;
}

const AlertsContext = createContext<AlertsValue | null>(null);

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown): void {
  void AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => undefined);
}

/**
 * The citizen's warnings and alert district. There is no OS push in scope, so
 * this checks every 30 s, when the app returns to the front, and when a screen
 * asks. The last answer is kept on the phone so warnings still show offline.
 */
export function AlertsProvider({
  children,
  source = apiAlertsSource,
  pollMs = ALERTS_POLL_MS,
}: {
  children: ReactNode;
  source?: AlertsSource;
  pollMs?: number;
}) {
  const [alerts, setAlerts] = useState<CitizenAlertDto[]>([]);
  const [profile, setProfile] = useState<CitizenProfileDto | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [stale, setStale] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [nextProfile, nextAlerts] = await Promise.all([source.getProfile(), source.listAlerts()]);
      if (!mounted.current) return;
      setProfile(nextProfile);
      setAlerts(Array.isArray(nextAlerts) ? nextAlerts : []);
      setProfileLoaded(true);
      setStale(false);
      writeCache(PROFILE_CACHE_KEY, nextProfile);
      writeCache(ALERTS_CACHE_KEY, nextAlerts);
    } catch {
      // Offline or the server is down: keep showing the saved copy.
      if (!mounted.current) return;
      setStale(true);
      setProfileLoaded(true);
    }
  }, [source]);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      const [cachedProfile, cachedAlerts] = await Promise.all([
        readCache<CitizenProfileDto>(PROFILE_CACHE_KEY),
        readCache<CitizenAlertDto[]>(ALERTS_CACHE_KEY),
      ]);
      if (!mounted.current) return;
      if (cachedProfile) setProfile(cachedProfile);
      if (cachedAlerts) setAlerts(cachedAlerts);
      await refresh();
    })();
    const timer = setInterval(() => void refresh(), pollMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      mounted.current = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh, pollMs]);

  const acknowledge = useCallback(
    async (id: string) => {
      const updated = await source.acknowledge(id);
      setAlerts((current) => {
        const next = current.map((alert) => (alert.id === id ? updated : alert));
        writeCache(ALERTS_CACHE_KEY, next);
        return next;
      });
    },
    [source],
  );

  const saveProfile = useCallback(
    async (input: RegisterCitizenInput) => {
      const saved = await source.saveProfile(input);
      setProfile(saved);
      setProfileLoaded(true);
      writeCache(PROFILE_CACHE_KEY, saved);
      void refresh();
    },
    [source, refresh],
  );

  const value = useMemo(
    () => ({ alerts, profile, profileLoaded, stale, refresh, acknowledge, saveProfile }),
    [alerts, profile, profileLoaded, stale, refresh, acknowledge, saveProfile],
  );
  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts(): AlertsValue {
  const value = useContext(AlertsContext);
  if (!value) throw new Error('useAlerts must be used inside AlertsProvider');
  return value;
}
```

`context/AlertsContext.test.tsx`:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { NetworkError } from '../api/client';
import { alert } from '../test/fixtures';
import { ALERTS_CACHE_KEY } from '../lib/alerts';
import { stubAlertsSource } from '../test/utils';
import { AlertsProvider, useAlerts, type AlertsSource } from './AlertsContext';

function Probe() {
  const { alerts, profile, stale } = useAlerts();
  return <Text>{JSON.stringify({ ids: alerts.map((a) => [a.id, a.acknowledgedAt]), district: profile?.district ?? null, stale })}</Text>;
}

let api: ReturnType<typeof useAlerts>;
function Grab() {
  api = useAlerts();
  return null;
}

async function renderWith(source: AlertsSource, pollMs = 30_000) {
  await render(
    <AlertsProvider source={source} pollMs={pollMs}>
      <Probe />
      <Grab />
    </AlertsProvider>,
  );
}

const shown = () => JSON.parse(screen.getByText(/ids/).props.children);

describe('AlertsProvider', () => {
  it('loads the profile and alerts', async () => {
    await renderWith(stubAlertsSource({ getProfile: async () => ({ district: 'COLOMBO', updatedAt: '' }), listAlerts: async () => [alert()] }));
    await waitFor(() => expect(shown()).toEqual({ ids: [['w1', null]], district: 'COLOMBO', stale: false }));
  });

  it('shows the saved alerts and marks them stale when offline', async () => {
    await AsyncStorage.setItem(ALERTS_CACHE_KEY, JSON.stringify([alert({ id: 'saved' })]));
    await renderWith(stubAlertsSource({ listAlerts: async () => { throw new NetworkError(); } }));
    await waitFor(() => expect(shown()).toMatchObject({ ids: [['saved', null]], stale: true }));
  });

  it('acknowledges and updates the list', async () => {
    const acknowledged = alert({ acknowledgedAt: '2026-10-07T10:00:00.000Z' });
    await renderWith(stubAlertsSource({ listAlerts: async () => [alert()], acknowledge: async () => acknowledged }));
    await waitFor(() => expect(shown().ids).toHaveLength(1));

    await act(() => api.acknowledge('w1'));
    expect(shown().ids).toEqual([['w1', '2026-10-07T10:00:00.000Z']]);
  });

  it('saves the profile, then checks for alerts in the new district', async () => {
    const listAlerts = jest.fn().mockResolvedValue([]);
    await renderWith(stubAlertsSource({ listAlerts, saveProfile: async (input) => ({ ...input, updatedAt: '' }) }));
    await waitFor(() => expect(listAlerts).toHaveBeenCalledTimes(1));

    await act(() => api.saveProfile({ district: 'KANDY' }));
    expect(shown().district).toBe('KANDY');
    await waitFor(() => expect(listAlerts).toHaveBeenCalledTimes(2));
  });

  it('checks again on the poll interval', async () => {
    jest.useFakeTimers();
    const listAlerts = jest.fn().mockResolvedValue([]);
    await renderWith(stubAlertsSource({ listAlerts }), 1000);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(listAlerts.mock.calls.length).toBeGreaterThanOrEqual(2);
    jest.useRealTimers();
  });

  it('fails loudly outside the provider', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow('useAlerts must be used inside AlertsProvider');
  });
});
```


- [ ] **Step 5: Wire the provider into the app and the test harness**

`App.tsx`: wrap `<NavigationContainer>` with `<AlertsProvider>` (inside `ReportQueueProvider`).

`test/utils.tsx`:

```tsx
import { AlertsProvider, type AlertsSource } from '../context/AlertsContext';

/** Nothing registered and no alerts, unless a test says otherwise. */
export function stubAlertsSource(overrides: Partial<AlertsSource> = {}): AlertsSource {
  return {
    getProfile: async () => null,
    saveProfile: async (input) => ({ ...input, updatedAt: new Date().toISOString() }),
    listAlerts: async () => [],
    acknowledge: async () => {
      throw new Error('acknowledge was not stubbed');
    },
    ...overrides,
  };
}
```

Change `renderApp(queue?: ReportQueue)` to `renderApp(queue?: ReportQueue, alerts: AlertsSource = stubAlertsSource())` and wrap `<NavigationContainer>` with `<AlertsProvider source={alerts}>`.

- [ ] **Step 6: Profile screen** — failing test first: `screens/profile.test.tsx`

```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderApp, stubAlertsSource } from '../test/utils';

jest.mock('../api/hazardReports');

async function openProfile(source = stubAlertsSource()) {
  await renderApp(undefined, source);
  await fireEvent.press(await screen.findByLabelText(/^Profile, tab/));
}

describe('Profile: alert area', () => {
  it('explains why the district is needed and requires one', async () => {
    await openProfile();

    expect(await screen.findByText(/We only send you warnings for this district/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save alert area' }));
    expect(await screen.findByText('Choose your district.')).toBeOnTheScreen();
  });

  it('rejects a phone number that is not a Sri Lankan mobile', async () => {
    await openProfile();

    await fireEvent.press(await screen.findByRole('button', { name: /^District/ }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Kandy' }));
    await fireEvent.changeText(screen.getByLabelText('Mobile number for SMS'), '12345');
    await fireEvent.press(screen.getByRole('button', { name: 'Save alert area' }));

    expect(await screen.findByText('Enter a Sri Lankan mobile number, such as 077 123 4567.')).toBeOnTheScreen();
  });

  it('saves the district with a normalised phone and confirms', async () => {
    const saveProfile = jest.fn(async (input) => ({ ...input, updatedAt: '2026-10-07T00:00:00Z' }));
    await openProfile(stubAlertsSource({ saveProfile }));

    await fireEvent.press(await screen.findByRole('button', { name: /^District/ }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Kandy' }));
    await fireEvent.changeText(screen.getByLabelText('Mobile number for SMS'), '077 123 4567');
    await fireEvent.press(screen.getByRole('button', { name: 'Save alert area' }));

    await waitFor(() => expect(saveProfile).toHaveBeenCalledWith({ district: 'KANDY', phone: '+94771234567' }));
    expect(await screen.findByText('Saved. You will get warnings for Kandy.')).toBeOnTheScreen();
  });

  it('shows the saved district and phone', async () => {
    await openProfile(stubAlertsSource({ getProfile: async () => ({ district: 'GALLE', phone: '+94771234567', updatedAt: '' }) }));

    expect(await screen.findByRole('button', { name: 'District: Galle' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Mobile number for SMS').props.value).toBe('077 123 4567');
  });

  it('keeps the entries and explains a failed save', async () => {
    await openProfile(stubAlertsSource({ saveProfile: async () => { throw new Error('x'); } }));

    await fireEvent.press(await screen.findByRole('button', { name: /^District/ }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Kandy' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save alert area' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'District: Kandy' })).toBeOnTheScreen();
  });
});
```

Run: `cd apps/mobile && bunx jest src/screens/profile.test.tsx`
Expected: FAIL (placeholder screen).

`screens/ProfileScreen.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { DISTRICTS, districtName, normalizeSriLankanMobile, type District } from '@repo/types';

import { describeError } from '../api/client';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { controlStyle, FormField } from '../components/FormField';
import { Screen } from '../components/Screen';
import { SelectField } from '../components/SelectField';
import { useAlerts } from '../context/AlertsContext';
import { formatLocalMobile } from '../lib/alerts';
import { colors, spacing, typography } from '../theme';

const OPTIONS = [...DISTRICTS]
  .map((value) => ({ value, label: districtName(value) }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** The citizen's alert area (finding UI5): warnings are targeted by this district. */
export function ProfileScreen() {
  const { profile, saveProfile } = useAlerts();
  const [district, setDistrict] = useState<District | null>(profile?.district ?? null);
  const [phone, setPhone] = useState(profile?.phone ? formatLocalMobile(profile.phone) : '');
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<{ district?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  // The saved profile can arrive after the screen opens; fill in only if the citizen has not started typing.
  useEffect(() => {
    if (!profile || touched) return;
    setDistrict(profile.district);
    setPhone(profile.phone ? formatLocalMobile(profile.phone) : '');
  }, [profile, touched]);

  async function save() {
    const normalized = phone.trim() === '' ? undefined : normalizeSriLankanMobile(phone);
    const next: typeof errors = {};
    if (!district) next.district = 'Choose your district.';
    if (normalized === null) next.phone = 'Enter a Sri Lankan mobile number, such as 077 123 4567.';
    setErrors(next);
    if (!district || normalized === null) return;

    setSaving(true);
    setMessage(null);
    try {
      await saveProfile({ district, ...(normalized && { phone: normalized }) });
      setMessage({ tone: 'success', text: `Saved. You will get warnings for ${districtName(district)}.` });
    } catch (error) {
      setMessage({ tone: 'danger', text: describeError(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen footer={<Button title="Save alert area" onPress={save} loading={saving} />}>
      <Text accessibilityRole="header" style={styles.title}>
        Alert Area
      </Text>
      <Text style={styles.text}>
        We only send you warnings for this district. Choose where you live or are staying now.
      </Text>

      {message && <Banner tone={message.tone}>{message.text}</Banner>}

      <SelectField
        label="District"
        required
        placeholder="Choose your district"
        value={district}
        options={OPTIONS}
        error={errors.district}
        onChange={(value) => {
          setTouched(true);
          setDistrict(value);
          setErrors((current) => ({ ...current, district: undefined }));
        }}
      />

      <FormField label="Mobile number for SMS" error={errors.phone} hint="Optional. Warnings also come by SMS when the app is closed.">
        <TextInput
          accessibilityLabel="Mobile number for SMS"
          keyboardType="phone-pad"
          placeholder="077 123 4567"
          placeholderTextColor={colors.textMuted}
          value={phone}
          onChangeText={(text) => {
            setTouched(true);
            setPhone(text);
            setErrors((current) => ({ ...current, phone: undefined }));
          }}
          style={[controlStyle(Boolean(errors.phone)), styles.input]}
        />
      </FormField>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.screenTitle, color: colors.text },
  text: { ...typography.body, fontSize: 14, color: colors.textMuted },
  input: { minHeight: 48, paddingVertical: spacing.sm },
});
```

In `navigation/MainTabs.tsx` replace the placeholder `ProfileScreen` const with `import { ProfileScreen } from '../screens/ProfileScreen';` and give the tab `options={{ title: 'Profile', ... }}` as before.

Run: `cd apps/mobile && bunx jest src/screens/profile.test.tsx src/context src/lib src/api`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): add alert area profile and alerts data provider"
```

---
### Task 13: Citizen app screens 4-6: Alerts list, Hazard Alert, Safety Info, Home and bell

**Files:**
- Create: `apps/mobile/src/components/LevelBadge.tsx`, `apps/mobile/src/components/AlertCard.tsx`
- Create: `apps/mobile/src/screens/AlertsScreen.tsx`, `apps/mobile/src/screens/HazardAlertScreen.tsx`, `apps/mobile/src/screens/SafetyInfoScreen.tsx`, `apps/mobile/src/screens/alerts.test.tsx`
- Modify: `apps/mobile/src/navigation/types.ts`, `apps/mobile/src/navigation/RootNavigator.tsx`, `apps/mobile/src/navigation/MainTabs.tsx`, `apps/mobile/src/screens/HomeScreen.tsx`, `apps/mobile/src/screens/screens.test.tsx`, `apps/mobile/src/screens/history.test.tsx`
- Delete: `apps/mobile/src/screens/PlaceholderScreen.tsx` (no tab uses it any more)

**Interfaces:**
- Consumes: `useAlerts`, `stubAlertsSource`, `alert()` fixture, `lib/alerts` helpers, `levelColors`, `formatDateTime` (Task 12).
- Produces: stack routes `HazardAlert: { id: string }` and `SafetyInfo: { id: string }`; `LevelBadge({ level, suffix? })`; `AlertCard({ alert, onPress })`.

- [ ] **Step 1: Write failing screen tests** — `screens/alerts.test.tsx`

```tsx
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { NetworkError } from '../api/client';
import { alert } from '../test/fixtures';
import { renderApp, stubAlertsSource } from '../test/utils';

jest.mock('../api/hazardReports');

const registered = { getProfile: async () => ({ district: 'COLOMBO' as const, updatedAt: '' }) };

async function openAlerts(overrides = {}) {
  await renderApp(undefined, stubAlertsSource({ ...registered, ...overrides }));
  await fireEvent.press(await screen.findByLabelText(/^Alerts, tab/));
}

describe('citizen alerts', () => {
  it('asks a citizen without a district to set one', async () => {
    await renderApp();
    await fireEvent.press(await screen.findByLabelText(/^Alerts, tab/));

    expect(await screen.findByText('Set your district to receive warnings')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Set district' }));
    expect(await screen.findByText('Alert Area')).toBeOnTheScreen();
  });

  it('lists active warnings first and all-clears after them', async () => {
    await openAlerts({
      listAlerts: async () => [
        alert({ id: 'a', level: 'CRITICAL' }),
        alert({ id: 'b', state: 'ALL_CLEAR', cancelReason: 'Water receded' }),
      ],
    });

    const cards = await screen.findAllByRole('button', { name: /WARNING|ALL CLEAR/ });
    expect(cards[0]).toHaveProp('accessibilityLabel', expect.stringContaining('FLOOD WARNING, Critical level'));
    expect(cards[1]).toHaveProp('accessibilityLabel', expect.stringContaining('ALL CLEAR'));
  });

  it('says when there are no warnings', async () => {
    await openAlerts();
    expect(await screen.findByText('No warnings for your area.')).toBeOnTheScreen();
  });

  it('says when it is showing saved alerts', async () => {
    await openAlerts({ listAlerts: async () => { throw new NetworkError(); } });
    expect(await screen.findByText('Could not check for new warnings. Showing the last saved list.')).toBeOnTheScreen();
  });

  it('opens a warning, acknowledges it, and shows safety information', async () => {
    const acknowledge = jest.fn(async () => alert({ acknowledgedAt: '2026-10-07T10:00:00.000Z' }));
    await openAlerts({ listAlerts: async () => [alert()], acknowledge });

    await fireEvent.press(await screen.findByRole('button', { name: /FLOOD WARNING/ }));
    expect(await screen.findByText('HIGH LEVEL')).toBeOnTheScreen();
    expect(screen.getByText('Heavy rainfall expected.')).toBeOnTheScreen();
    expect(screen.getByText('1. Move to higher ground immediately')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Acknowledge Warning' }));

    await waitFor(() => expect(acknowledge).toHaveBeenCalledWith('w1'));
    expect(await screen.findByText('Alert Acknowledged')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'DMC Hotline: 117' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Police: 119' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Ambulance: 110' })).toBeOnTheScreen();
  });

  it('calls an emergency number from Safety Info', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await openAlerts({ listAlerts: async () => [alert({ acknowledgedAt: '2026-10-07T10:00:00.000Z' })] });

    await fireEvent.press(await screen.findByRole('button', { name: /FLOOD WARNING/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'View Safety Info' }));
    await fireEvent.press(await screen.findByRole('link', { name: 'DMC Hotline: 117' }));

    expect(openURL).toHaveBeenCalledWith('tel:117');
  });

  it('opens the map at the district', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await openAlerts({ listAlerts: async () => [alert()] });

    await fireEvent.press(await screen.findByRole('button', { name: /FLOOD WARNING/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'View Map' }));

    expect(openURL).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=6.9271,79.8612');
  });

  it('keeps the warning open and explains when acknowledging fails', async () => {
    await openAlerts({ listAlerts: async () => [alert()], acknowledge: async () => { throw new NetworkError(); } });

    await fireEvent.press(await screen.findByRole('button', { name: /FLOOD WARNING/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Acknowledge Warning' }));

    expect(await screen.findByText(/You seem to be offline/)).toBeOnTheScreen();
    expect(screen.getByText('HIGH LEVEL')).toBeOnTheScreen();
  });

  it('shows an All Clear without asking to acknowledge', async () => {
    await openAlerts({ listAlerts: async () => [alert({ state: 'ALL_CLEAR', cancelReason: 'Water has receded' })] });

    await fireEvent.press(await screen.findByRole('button', { name: /ALL CLEAR/ }));

    expect(await screen.findByText('All clear: Water has receded')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Acknowledge Warning' })).toBeNull();
  });

  describe('home', () => {
    it('turns the status card to the most severe active warning and lists recent ones', async () => {
      await renderApp(undefined, stubAlertsSource({ ...registered, listAlerts: async () => [alert({ level: 'CRITICAL' })] }));

      expect(await screen.findByText('Current Status: Critical warning')).toBeOnTheScreen();
      expect(screen.getByText('1 active warning in your area')).toBeOnTheScreen();
      const recent = screen.getByLabelText('Recent Alerts');
      expect(within(recent).getByRole('button', { name: /FLOOD WARNING/ })).toBeOnTheScreen();
    });

    it('counts unacknowledged warnings on the bell and opens the Alerts tab', async () => {
      await renderApp(undefined, stubAlertsSource({ ...registered, listAlerts: async () => [alert()] }));

      await fireEvent.press(await screen.findByRole('button', { name: 'Notifications, 1 new' }));
      expect(await screen.findByRole('button', { name: /FLOOD WARNING/ })).toBeOnTheScreen();
    });
  });
});
```

Update the two old tests that expected the placeholder:
- `screens.test.tsx` "opens a coming-soon page for tabs built by other use cases": rename to "opens the Alerts tab" and expect `await screen.findByText('Set your district to receive warnings')`.
- `history.test.tsx` "opens the Alerts tab when pressed": expect the same text instead of `'This section is coming soon.'`.

Run: `cd apps/mobile && bunx jest src/screens/alerts.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Routes** — `navigation/types.ts`, add to `RootStackParamList`:

```ts
  /** One warning: details, safety instructions, acknowledge (wireframe screen 5). */
  HazardAlert: { id: string };
  /** After acknowledging: emergency contacts and what to do (wireframe screen 6). */
  SafetyInfo: { id: string };
```

In `RootNavigator.tsx` register both (titles `'Hazard Alert'` and `'Safety Info'`).

- [ ] **Step 3: Components**

`components/LevelBadge.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';

import { WARNING_LEVEL_LABELS, type WarningLevel } from '@repo/types';

import { levelColors, radius, spacing, typography } from '../theme';

/** "HIGH LEVEL" pill in the level's colour, as on the wireframe. */
export function LevelBadge({ level, suffix = '' }: { level: WarningLevel; suffix?: string }) {
  const { background, text } = levelColors[level];
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.text, { color: text }]}>
        {`${WARNING_LEVEL_LABELS[level]}${suffix}`.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: radius.control, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  text: { ...typography.label },
});
```

`components/AlertCard.tsx`:

```tsx
import { AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WARNING_LEVEL_LABELS, type CitizenAlertDto } from '@repo/types';

import { alertTitle, describeAlertDistricts } from '../lib/alerts';
import { formatRelativeTime } from '../lib/time';
import { colors, levelColors, radius, spacing, typography } from '../theme';

/** One warning in a list. All Clears and expired warnings are greyed. */
export function AlertCard({ alert, onPress }: { alert: CitizenAlertDto; onPress: () => void }) {
  const active = alert.state === 'ACTIVE';
  const title = alert.state === 'ALL_CLEAR' ? 'ALL CLEAR' : alertTitle(alert);
  const accent = active ? levelColors[alert.level].background : colors.border;
  const label = [
    title,
    active ? `${WARNING_LEVEL_LABELS[alert.level]} level` : alert.state === 'EXPIRED' ? 'expired' : alertTitle(alert),
    describeAlertDistricts(alert),
    alert.acknowledgedAt ? 'acknowledged' : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderLeftColor: accent }, !active && styles.muted, pressed && styles.pressed]}
    >
      {active ? <AlertTriangle size={22} color={colors.danger} /> : <CheckCircle2 size={22} color={colors.success} />}
      <View style={styles.body}>
        <Text style={[styles.title, { color: active ? colors.danger : colors.success }]}>{title}</Text>
        <Text style={styles.meta}>{describeAlertDistricts(alert)} · {formatRelativeTime(alert.issuedAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  muted: { opacity: 0.7 },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: spacing.xs },
  title: { ...typography.body, fontWeight: '700' },
  meta: { ...typography.helper, color: colors.textMuted },
});
```

- [ ] **Step 4: Alerts tab** — `screens/AlertsScreen.tsx`

```tsx
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AlertCard } from '../components/AlertCard';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useAlerts } from '../context/AlertsContext';
import type { TabScreenProps } from '../navigation/types';
import { colors, typography } from '../theme';

/** Wireframe screen 4 (finding UI3): every warning that reached this phone. */
export function AlertsScreen({ navigation }: TabScreenProps<'Alerts'>) {
  const { alerts, profile, profileLoaded, stale, refresh } = useAlerts();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <Screen>
      {profileLoaded && !profile && (
        <Banner tone="warning" action={<Button title="Set district" variant="ghost" onPress={() => navigation.navigate('Profile')} />}>
          Set your district to receive warnings
        </Banner>
      )}
      {stale && <Banner tone="warning">Could not check for new warnings. Showing the last saved list.</Banner>}

      {alerts.length === 0 ? (
        profile && <Text style={styles.empty}>No warnings for your area.</Text>
      ) : (
        <View style={styles.list}>
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onPress={() => navigation.navigate('HazardAlert', { id: alert.id })} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
```

- [ ] **Step 5: Hazard Alert** — `screens/HazardAlertScreen.tsx`

```tsx
import { AlertTriangle } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { describeError } from '../api/client';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { LevelBadge } from '../components/LevelBadge';
import { Screen } from '../components/Screen';
import { useAlerts } from '../context/AlertsContext';
import { alertTitle, describeAlertDistricts, mapsUrl } from '../lib/alerts';
import { formatDateTime } from '../lib/time';
import type { ScreenProps } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';

/** Wireframe screen 5. Acknowledging leads to Safety Info. */
export function HazardAlertScreen({ route, navigation }: ScreenProps<'HazardAlert'>) {
  const { alerts, acknowledge } = useAlerts();
  const alert = alerts.find((item) => item.id === route.params.id);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!alert) {
    return (
      <Screen footer={<Button title="Back to alerts" variant="ghost" onPress={() => navigation.goBack()} />}>
        <Text style={styles.text}>This warning is no longer available.</Text>
      </Screen>
    );
  }

  const active = alert.state === 'ACTIVE';

  async function onAcknowledge() {
    setSending(true);
    setFailure(null);
    try {
      await acknowledge(alert!.id);
      navigation.navigate('SafetyInfo', { id: alert!.id });
    } catch (error) {
      setFailure(describeError(error));
    } finally {
      setSending(false);
    }
  }

  const footer = (
    <>
      <Button title="View Map" variant="ghost" onPress={() => void Linking.openURL(mapsUrl(alert.districts[0]!))} />
      {active &&
        (alert.acknowledgedAt ? (
          <Button title="View Safety Info" onPress={() => navigation.navigate('SafetyInfo', { id: alert.id })} />
        ) : (
          <Button title="Acknowledge Warning" loading={sending} onPress={onAcknowledge} />
        ))}
    </>
  );

  return (
    <Screen footer={footer}>
      {failure && <Banner tone="danger">{failure}</Banner>}
      {alert.state === 'ALL_CLEAR' && <Banner tone="success">{`All clear: ${alert.cancelReason ?? 'the warning has been lifted.'}`}</Banner>}
      {alert.state === 'EXPIRED' && <Banner tone="warning">This warning has expired.</Banner>}
      {alert.acknowledgedAt && active && <Banner tone="success">{`You acknowledged this warning on ${formatDateTime(alert.acknowledgedAt)}.`}</Banner>}

      <View style={styles.card}>
        <View style={styles.row}>
          <AlertTriangle size={22} color={colors.danger} />
          <Text accessibilityRole="header" style={styles.title}>{alertTitle(alert)}</Text>
        </View>
        <LevelBadge level={alert.level} suffix=" level" />
        <Text style={styles.text}>{describeAlertDistricts(alert)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.meta}>{`Issued: ${formatDateTime(alert.issuedAt)}`}</Text>
        <Text style={styles.meta}>{`Valid until: ${formatDateTime(alert.validUntil)}`}</Text>
        <Text style={styles.label}>Description</Text>
        <Text style={styles.text}>{alert.description}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Safety Instructions</Text>
        {alert.safetyInstructions.map((step, index) => (
          <Text key={step} style={styles.text}>{`${index + 1}. ${step}`}</Text>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 20, fontWeight: '700', color: colors.danger },
  label: { ...typography.label, color: colors.navy, textTransform: 'uppercase' },
  text: { ...typography.body, color: colors.text },
  meta: { ...typography.helper, color: colors.textMuted },
});
```

- [ ] **Step 6: Safety Info** — `screens/SafetyInfoScreen.tsx`

```tsx
import { CheckCircle2, Phone } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useAlerts } from '../context/AlertsContext';
import type { ScreenProps } from '../navigation/types';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '../theme';

const CONTACTS = [
  { name: 'DMC Hotline', number: '117' },
  { name: 'Police', number: '119' },
  { name: 'Ambulance', number: '110' },
] as const;

/**
 * Wireframe screen 6. Nearest shelters and the evacuation map are left out:
 * no shelter or route data exists yet (scope note in the critique).
 */
export function SafetyInfoScreen({ route, navigation }: ScreenProps<'SafetyInfo'>) {
  const { alerts } = useAlerts();
  const alert = alerts.find((item) => item.id === route.params.id);

  return (
    <Screen footer={<Button title="Back to alerts" variant="ghost" onPress={() => navigation.navigate('Main', { screen: 'Alerts' })} />}>
      <View style={styles.done}>
        <CheckCircle2 size={48} color={colors.success} />
        <Text accessibilityRole="header" style={styles.doneText}>Alert Acknowledged</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Emergency Contacts</Text>
        {CONTACTS.map(({ name, number }) => (
          <Pressable
            key={number}
            accessibilityRole="link"
            accessibilityLabel={`${name}: ${number}`}
            accessibilityHint="Calls this number"
            onPress={() => void Linking.openURL(`tel:${number}`)}
            style={styles.contact}
          >
            <Phone size={18} color={colors.navy} />
            <Text style={styles.text}>{`${name}: ${number}`}</Text>
          </Pressable>
        ))}
      </View>

      {alert && (
        <View style={styles.card}>
          <Text style={styles.label}>What to do now</Text>
          {alert.safetyInstructions.map((step, index) => (
            <Text key={step} style={styles.text}>{`${index + 1}. ${step}`}</Text>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  doneText: { fontSize: 20, fontWeight: '700', color: colors.success },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  label: { ...typography.label, color: colors.navy, textTransform: 'uppercase' },
  contact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: TOUCH_TARGET },
  text: { ...typography.body, color: colors.text },
});
```

- [ ] **Step 7: Tabs, Home and bell**

`navigation/MainTabs.tsx`:
- replace the placeholder `AlertsScreen` const with `import { AlertsScreen } from '../screens/AlertsScreen';`, remove the `PlaceholderScreen` import, and delete `screens/PlaceholderScreen.tsx`;
- in `BellButton` add `const { alerts } = useAlerts();` and compute `const total = unread.length + unacknowledged(alerts).length;`, then use `total` everywhere `unread.length` was used (label, badge visibility, badge text).

`screens/HomeScreen.tsx`: add `const { alerts } = useAlerts();`, then replace the status card and the Recent Alerts section with:

```tsx
  const level = highestLevel(alerts);
  const active = activeAlerts(alerts);
  const recent = alerts.slice(0, 2);
```

```tsx
      <View style={[styles.card, level && { borderLeftColor: levelColors[level].background }]}>
        {level ? <AlertTriangle size={24} color={colors.danger} /> : <ShieldCheck size={24} color={colors.success} />}
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>
            {level ? `Current Status: ${WARNING_LEVEL_LABELS[level]} warning` : 'Current Status: Safe'}
          </Text>
          <Text style={styles.muted}>
            {active.length === 0
              ? 'No active alerts in your area'
              : `${active.length} active warning${active.length === 1 ? '' : 's'} in your area`}
          </Text>
        </View>
      </View>
```

```tsx
      <View style={styles.section} accessibilityLabel="Recent Alerts">
        <Text style={styles.sectionTitle}>Recent Alerts</Text>
        {recent.length === 0 ? (
          <Text style={styles.muted}>No recent alerts.</Text>
        ) : (
          recent.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onPress={() => navigation.navigate('HazardAlert', { id: alert.id })} />
          ))
        )}
      </View>
```

with imports `WARNING_LEVEL_LABELS` from `@repo/types`, `AlertCard`, `useAlerts`, `activeAlerts`, `highestLevel` from `../lib/alerts`, `levelColors` from `../theme`. The existing Home tests ("Current Status: Safe", "No active alerts in your area", "Recent Alerts") keep passing because the stub has no alerts.

- [ ] **Step 8: Full mobile gate and commit**

Run: `cd apps/mobile && bun run test:cov && bun run check-types && bun run lint`
Expected: all PASS; global coverage above 80%; `screens/AlertsScreen`, `HazardAlertScreen`, `SafetyInfoScreen`, `ProfileScreen`, `context/AlertsContext` above 90%.

Simulator check (manual): `bun run --filter mobile dev`, press `i`. Profile: set Colombo. Portal: issue a HIGH Flood warning for Colombo. Phone: within 30 s (or on opening Alerts) the card appears, Home turns to "Current Status: High warning", the bell shows 1; open, Acknowledge, Safety Info; then cancel in the portal and see "All clear: …" on the phone.

```bash
git add -A apps/mobile
git commit -m "feat(mobile): add alerts list, hazard alert, safety info and home status"
```

---
### Task 14: Style guide, README, spec sync, and the critique document

**Files:**
- Modify: `docs/style-guide.md`, `README.md`, `docs/superpowers/specs/2026-10-07-hazard-warning-design.md`
- Create: `docs/critique/hazard-warning/critique.html`, `docs/critique/hazard-warning/revised-sequence.drawio`, `docs/critique/hazard-warning/revised-sequence.png` (exported), `docs/critique/hazard-warning/screenshots/*.png` (captured)

**Interfaces:**
- Consumes: the findings table in the spec (UC1-UI7), the running apps (Tasks 1-13).
- Produces: a critique in the same structure as IT23733794's `submit-verify-critique-short.pdf`: (1) identified issues and proposed changes, (2) revised sequence diagram, (3) implemented user interfaces and application flow, appendix of AI prompts.

- [ ] **Step 1: Style guide** — add a subsection to `docs/style-guide.md` under the status chips section:

```markdown
### Warning levels (Issue and Disseminate Hazard Warning)

Taken from the Issue Hazard Warning wireframe's level buttons. Same colour on every screen; always shown with the level's name, never colour alone.

| Level | Background | Text | Token |
|---|---|---|---|
| Critical | `danger` | white | `bg-danger text-white` / `levelColors.CRITICAL` |
| High | `orange` | white | `bg-orange text-white` / `levelColors.HIGH` |
| Medium | `warning-tint` | `warning-text` | `bg-warning-tint text-warning-text` / `levelColors.MEDIUM` |
| Low | `success` | white | `bg-success text-white` / `levelColors.LOW` |

Orange is used here for status on purpose: the wireframe's High level is orange. It is the only status use of orange.

Warning status chips: Draft and Cancelled neutral, Disseminating and Partially Disseminated amber, Disseminated green, Pending Dissemination red, Expired neutral.
```

- [ ] **Step 2: README** — in `README.md`:
- In the API configuration table add a row: `SIMULATE_CHANNEL_FAILURE` | no | Comma list of `PUSH`, `SMS`, `AUDIBLE` whose simulated gateway fails, to demonstrate partial dissemination and retry. Empty normally.
- In "Running each app", Web row: add "Warnings: Issue Warning, Warnings (Active, Drafts, Past), Dissemination Status."
- In "Try the whole flow", append:

```markdown
5. **Warning (phone):** Profile tab, choose a district (and optionally a mobile number), Save alert area.
6. **Warning (portal):** Issue Warning, fill the form for the same district, Review Warning (shows how many citizens it reaches), Confirm Warning. The status page shows Push, SMS and Audible Alert delivery.
7. **Phone:** the Alerts tab and Home show the warning within 30 seconds. Open it, Acknowledge Warning, see Safety Info.
8. **Portal:** Cancel Warning with a reason. The phone shows the All Clear.
9. **Partial delivery:** stop the API, set `SIMULATE_CHANNEL_FAILURE=SMS` in `apps/api/.env`, start it, issue a warning: status is Partially Disseminated. Remove the setting, restart, press Retry on the SMS card.
10. **From a report:** open a Verified report in the portal and press "Issue Warning from this report".
```

- [ ] **Step 3: Spec sync** — edit the spec to match two decisions taken while planning:
- `GET /alerts/mine` row: "Warnings **delivered to this device** that are active, plus those cancelled or expired in the last 7 days" (the delivery row is the in-app push; a citizen who registers after a warning was sent does not receive it, which matches how a push works).
- Citizen App, Profile tab: "district list" (not "searchable district list"; 25 entries fit one scrolling sheet).

- [ ] **Step 4: Revised sequence diagram** — `docs/critique/hazard-warning/revised-sequence.drawio`

Start from Group_052's diagram (p. 26): keep its original lifelines and black messages, and draw every added or changed element in orange (`strokeColor=#E67E22;fontColor=#E67E22`) with its finding tag in brackets, exactly like IT23733794's revised diagram. Add a legend box at the top: "Orange = added or changed to fix the issues found. SQ1 validation in the service. SQ2 Controller → Service → Repository. SQ3 alt fragments for every exception. SQ4 par over the channels."

Lifelines, left to right: Duty Officer (actor) · Warning Management UI (boundary) · HazardWarningController (control) · **HazardWarningService (control) [SQ2]** · Hazard Information *(original; now the verified HazardReport [SC2])* · Location Management *(now CitizenDirectory [CL5])* · Warning Database *(now HazardWarningRepository)* · **WarningDisseminator [SQ2]** · Notification Service *(now the NotificationChannel list: Push / SMS / Audible [CL4])* · Citizen (actor).

Messages in order (number them as drawn):
1. Duty Officer → UI: selectIssueWarning() — and **[UC2] opt "from verified report": UI → Controller: getPrefill(reportId) → Service → HazardReportRepository.findById → returns hazardType, nearest district, description**
2. UI → Duty Officer: displayWarningForm()
3. Duty Officer → UI: enterWarningDetails(hazardType, level, description, **safetyInstructions [UI2]**, districts, validPeriod)
4. **[SQ1] UI: validate (instant feedback); alt invalid → show field errors, keep entries**
5. **alt [UI1/CL2] "Save as Draft": UI → Controller: create(action=DRAFT) → Service → Repository.create(status=DRAFT) → "Draft saved"**
6. Duty Officer → UI: reviewWarning()
7. **[SQ1] UI → Controller: preview(details) → Service: validate (authoritative) → CitizenDirectory.countInDistricts(districts) and Repository.findActiveOverlapping(type, districts)**
8. UI → Duty Officer: displayWarningPreview(summary, **recipientCount [SC1]**, **duplicates [UI7]**)
9. **alt [SC1] recipientCount = 0: "No registered recipients found for the selected area." officer goes Back or confirms**
10. **alt [UI7] duplicate active warning: confirm requires "Issue anyway" (force)**
11. Duty Officer → UI: confirmWarning() — **[UI7] second confirmation: "cannot be recalled"**
12. UI → Controller: createWarning(details, level, area, **clientRequestId**) **[SQ2]** → Service: createWarning
13. **alt [CL3] replay of the same clientRequestId: return stored warning, nothing sent**
14. Service → Repository: saveWarning(details, status=DISSEMINATING) → warningSaved(warningId)
15. **alt database unavailable: 500 → UI "Warning could not be saved. Please try again." (entries kept)**
16. Service → WarningDisseminator: send(warning, [PUSH, SMS, AUDIBLE]) **[SQ2]**
17. WarningDisseminator → CitizenDirectory: getCitizensInAffectedArea(districts) → citizenList
18. **alt directory unavailable: every channel FAILED "Notification service is temporarily unavailable." [SQ3]**
19. **par [SQ4]** WarningDisseminator → Push channel: send(message, citizens) → AlertDelivery rows → Citizen app ‖ → SMS channel: send(message, citizens with phone) ‖ → Audible channel: send(message, districts)
20. **alt per channel [SQ3]: SENT / SKIPPED (no recipients) / FAILED (error recorded); each attempt logged to NotificationLog**
21. WarningDisseminator → Service: channel statuses → Service: overallStatus = DISSEMINATED | PARTIALLY_DISSEMINATED | PENDING_DISSEMINATION
22. Service → Repository: updateDisseminationStatus(warningId, channels, status) → statusUpdated()
23. Controller → UI: displayWarningStatus(status) → Duty Officer: showDisseminationResult(status)
24. **Separate frame "Retry Failed Channel" [UC3]: Duty Officer → UI: retry() → Controller → Service: retry(id) → Repository.startDissemination(from PARTIAL/PENDING) → Disseminator.send(failed channels only) → updateDisseminationStatus; alt nothing to retry / another officer already retrying → 409**
25. **Separate frame "Cancel Warning" [UC1, UI4]: Duty Officer → UI: cancel(reason) → Controller → Service: cancel → Repository.cancel (only while issued) → Disseminator.announceAllClear → channels; alt already cancelled → 409**
26. **Citizen side [UC3, UI3]: Citizen → app: open Alerts → GET alerts/mine → list; Citizen → app: acknowledge() → POST acknowledge → Safety Info**

Export the page as PNG (File → Export as → PNG, 200% zoom, white background) to `revised-sequence.png`. Keep the `.drawio` file editable and link it in the critique.

- [ ] **Step 5: Screenshots** — run all three apps (README Quick start) and capture, at the same window sizes as the teammate's (portal ~1440 px wide, iPhone 15 simulator):

| File | Screen |
|---|---|
| `01-issue-form.png` | Portal, Issue Hazard Warning, filled (HIGH, Colombo + Gampaha, 3 instructions) |
| `02-form-errors.png` | Portal, form after Review Warning on an empty form (inline errors) |
| `03-review.png` | Portal, Review Warning with Total Citizens in Area |
| `04-review-duplicate.png` | Portal, Review with the duplicate banner and "Issue anyway" |
| `05-confirm.png` | Portal, "Issue this warning?" dialog |
| `06-status-ok.png` | Portal, Dissemination Status, all channels Completed |
| `07-status-partial.png` | Portal, Partially Disseminated with SMS Failed and Retry (`SIMULATE_CHANNEL_FAILURE=SMS`) |
| `08-cancel.png` | Portal, Cancel dialog with reason |
| `09-warnings-list.png` | Portal, Warnings list (Active tab) |
| `10-escalate.png` | Portal, verified report with "Issue Warning from this report" |
| `11-profile.png` | Phone, Profile / Alert Area |
| `12-home-warning.png` | Phone, Home with the red status card and Recent Alerts |
| `13-alerts.png` | Phone, Alerts tab |
| `14-hazard-alert.png` | Phone, Hazard Alert detail |
| `15-safety-info.png` | Phone, Safety Info after acknowledging |
| `16-all-clear.png` | Phone, the All Clear |

- [ ] **Step 6: Critique document** — `docs/critique/hazard-warning/critique.html`

Self-contained HTML (no external assets except the PNGs beside it), A4 print-friendly, matching the teammate's PDF: navy (`#17324d`) title, orange (`#e67e22`) rule under section headings, navy table header with white text, light-orange background on the "Proposed change" cells that add something new. Structure:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Issue and Disseminate Hazard Warning: Critique</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Inter, system-ui, sans-serif; color: #263238; line-height: 1.45; max-width: 190mm; margin: auto; }
    h1 { color: #17324d; font-size: 32px; margin-bottom: 4px; }
    .owner { color: #667085; margin-top: 0; }
    h2 { color: #17324d; border-bottom: 3px solid #e67e22; padding-bottom: 6px; margin-top: 32px; }
    .key { background: #f5f7fa; border-left: 4px solid #17324d; padding: 8px 12px; font-weight: 600; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th { background: #17324d; color: #fff; text-align: left; padding: 8px; }
    td { border: 1px solid #d9dee5; padding: 8px; vertical-align: top; }
    td.id { font-weight: 700; width: 36px; }
    td.added { background: #fff1e5; }
    tr { break-inside: avoid; }
    figure { margin: 16px 0; break-inside: avoid; }
    figcaption { font-size: 12px; color: #667085; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .grid.wide { grid-template-columns: 1fr; }
    img { width: 100%; border: 1px solid #d9dee5; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Issue and Disseminate Hazard Warning</h1>
  <p class="owner">Use case owner: IT23860964 · Group 052 · Implemented by IT23713994 (Group 050)</p>

  <h2>1. Identified issues and proposed changes</h2>
  <p>These are the identified issues in the use case diagram, class diagram, sequence diagram, use case scenario and wireframes related to this use case. Each issue has an ID, and the proposed change is the one drawn in the revised diagrams and built in the implementation.</p>
  <p class="key">ID key: UC = Use case diagram · CL = Class diagram · SQ = Sequence diagram · SC = Use case scenario · UI = Wireframes</p>
  <table>
    <thead><tr><th>ID</th><th>Finding in the original</th><th>Why it matters</th><th>Proposed change</th></tr></thead>
    <tbody>
      <!-- One <tr> per row of the spec's "Critique Findings" table, in the same order (UC1-UC3, CL1-CL5, SQ1-SQ4, SC1-SC2, UI1-UI7). Copy the three text columns verbatim from the spec. Give the "Proposed change" cell class="added" when the change adds a new element (UC1, UC2, UC3, CL2, CL3, CL4, SQ3, UI2, UI4, UI5, UI7). -->
    </tbody>
  </table>

  <h3>Scope notes</h3>
  <ul>
    <!-- The spec's "Out of scope, recorded as scope notes" list, one <li> each, with the reason. -->
  </ul>

  <h2>2. Revised sequence diagram</h2>
  <p>Sequence diagram for Issue and Disseminate Hazard Warning with the fixes SQ1 to SQ4 applied. The original lifelines and messages are kept. Orange marks what was added or changed, and each tag is the ID of the issue it fixes. Editable diagram in draw.io: <a href="revised-sequence.drawio">revised-sequence.drawio</a></p>
  <figure><img src="revised-sequence.png" alt="Revised sequence diagram" /></figure>

  <h2>3. Implemented user interfaces and application flow</h2>
  <p>DMC Portal (React) for the Duty Officer and the citizen mobile app (Expo), backed by a NestJS API with MongoDB. SMS and audible alert gateways are simulated; the in-app push is real.</p>
  <div class="grid wide">
    <!-- Portal screenshots 01-10, one <figure> each, caption "N. Title. One sentence on what the officer does and which finding it shows." -->
  </div>
  <div class="grid">
    <!-- Phone screenshots 11-16, same caption style. -->
  </div>

  <h3>Flow</h3>
  <ol>
    <li>The citizen sets a district (and optionally a mobile number) in Profile.</li>
    <li>The officer opens Issue Warning (or "Issue Warning from this report" on a verified report), enters the hazard type, level, description, safety instructions, districts and valid period, or saves a draft.</li>
    <li>Review Warning shows the summary, how many registered citizens it reaches, and any active warning that already covers the area.</li>
    <li>After two confirmations the warning is stored and sent on push, SMS and audible alert at once. Each channel's result is recorded; the overall status is Disseminated, Partially Disseminated or Pending Dissemination.</li>
    <li>The officer retries failed channels from the status page, or cancels the warning with a reason, which sends an All Clear.</li>
    <li>The citizen sees the warning on Home and in Alerts, acknowledges it, and gets Safety Info with emergency numbers 117, 119 and 110; later the All Clear replaces it.</li>
  </ol>
  <p><strong>Verification:</strong> <!-- fill from Task 15: test counts and statement coverage for API, portal and mobile --></p>

  <h2>Appendix: AI prompts used</h2>
  <p>Claude was used to find the issues in the given design and to plan and build the implementation. The prompts used, in order:</p>
  <ol>
    <li>in this project my part is 'Broadcast Hazard Alert' take a look at "docs/SE3070 Assignment 01.docx" my part … take a look at project first and understand it then we can move forward for my part</li>
    <li>yes, go with Group_052 plus my improvements but before that check with other member 'IT23733794' as well he follow the same like us? or only follow the group_52 things only? and also we have to create the critique doc as well</li>
    <li>Cool then follow IT23733794's flow and do whats in group52's doc</li>
    <!-- add every later prompt used to build or check this use case -->
  </ol>
</body>
</html>
```

Fill every commented block with real content before export (they are instructions to you, not text to leave in). Open the file in Chrome → Print → Save as PDF (A4, margins default, background graphics on) to `docs/critique/hazard-warning/issue-disseminate-warning-critique.pdf`.

- [ ] **Step 7: Commit**

```bash
git add docs README.md
git commit -m "docs: add hazard warning critique, revised sequence diagram and setup notes"
```

---

### Task 15: Final verification and hand-off

**Files:** none new (fixes only, if a check fails).

- [ ] **Step 1: Whole-repo gate**

Run (from the repo root):

```bash
bun run --filter @repo/types build && bun run check-types && bun run lint && bun run format:check && bun run test
cd apps/api && bun run test:cov && bun run test:e2e && cd ../..
cd apps/web && bun run test:cov && cd ../..
cd apps/mobile && bun run test:cov && cd ../..
```

Expected: everything PASS. Record the test counts and the statement coverage per app; write them into the critique's Verification line (Task 14 Step 6) and into `docs/superpowers/evidence/coverage-*.txt` the same way the existing evidence files were produced.

- [ ] **Step 2: Manual pass over every flow in the revised scenario** (portal + phone + API running)

| Flow | Check |
|---|---|
| Main flow | Issue → status Disseminated → phone shows it → acknowledge → Safety Info |
| Invalid details / level / area | Empty form → inline errors, focus on first; API 400 messages readable |
| Officer modifies before confirmation | Review → Back keeps every entry |
| No citizens in area | District with nobody registered → amber banner, still issuable, audible SENT, push/SMS SKIPPED |
| Duplicate | Second HIGH Flood for Colombo → banner, Confirm disabled until "Issue anyway" |
| Partial dissemination + retry | `SIMULATE_CHANNEL_FAILURE=SMS` → Partially Disseminated; clear the setting, restart, Retry SMS → Disseminated |
| Notification service unavailable | `SIMULATE_CHANNEL_FAILURE=PUSH,SMS,AUDIBLE` → Pending Dissemination + Retry |
| Database unavailable | With the API running, turn Wi-Fi off so Atlas is unreachable, then Confirm → error banner ("The server hit a problem…" or "Cannot reach the server…"), review entries kept; Wi-Fi on, Confirm again works |
| Save as Draft / edit / issue draft | Draft appears in Drafts tab, edit, review, issue |
| Cancel / All Clear | Cancel with reason → phone shows All Clear; cancel again → 409 message |
| From verified report | Verified report → Issue Warning from this report → prefilled banner |
| Offline phone | Airplane mode → Alerts shows saved list with the stale banner |
| Double click Confirm | Only one warning created (clientRequestId replay) |

Fix anything that fails with a test first (TDD), then re-run Step 1.

- [ ] **Step 3: Update the plan checkboxes and push for review**

Mark finished steps `[x]` in this plan. Then **ask the user before pushing**: push `feat/hazard-warning-issue-disseminate` and open a PR to `main` like the teammate's PRs (title "feat: issue and disseminate hazard warning", body summarising findings UC1-UI7 → code, test counts, and how to try it). No `Co-Authored-By` / `Claude-Session` trailers in commits.
