# Issue and Disseminate Hazard Warning: Design

Use case owner in this group: IT23713994 (T.H.P Janith M). Source design: `docs/superpowers/misc/Group_052.pdf`, section 5 (pp. 22-32, original owner IT23860964). Grading rules: `SE3070 Case Study Assignment 02 Specification.pdf`.

## Goal

Implement Group_052's "Issue and Disseminate Hazard Warning" end to end (API, DMC Portal, citizen app), with the fixes from our critique of that design. The method follows IT23733794's Submit and Verify work: every difference from the original is a numbered finding (UC / CL / SQ / UI) that appears in both the critique document and the code. Nothing changes without a finding behind it.

## Scope

In scope:

- The main flow: form, review with recipient count, confirm, store, find recipients, send by channel, record status per channel, show the result.
- Alternate flows from the original: invalid level, invalid area, multiple channels, partial dissemination with retry, officer edits before confirming.
- Exception flows from the original: hazard information unavailable, database unavailable, notification service unavailable, SMS failure, audible alert failure, no citizens in the area, invalid details.
- Extensions, each justified by a finding: Save as Draft, Cancel warning with All Clear, issue from a VERIFIED hazard report, duplicate active warning check, citizen acknowledgement, citizen district registration.

Out of scope, recorded as scope notes in the critique:

- River basins (districts only, as in the wireframe).
- Nearest shelters and the evacuation route map on Safety Info (no shelter or route data exists; shelters belong to another use case).
- The "I'm safe" button (nothing in the scenario receives it).
- Update or supersede an issued warning (cancel then issue a new one).
- Real SMS gateways, sirens and OS push. SMS and Audible Alert are simulated gateways; in-app push is real (the phone polls).
- Login (not graded). Identity uses the existing stubs: `x-officer-key` for officers, `x-reporter-id` (device UUID) for citizens.

## Critique Findings (drive the code and the report)

ID key: UC use case diagram, CL class diagram, SQ sequence diagram, SC scenario, UI wireframes.

| ID | Finding in the original | Why it matters | Proposed change |
|---|---|---|---|
| UC1 | "Reject Warning" extends "Issue & Disseminate Hazard Warning", but no flow in the scenario rejects a warning, and the officer issuing it is the one who would reject it. | A use case with no scenario cannot be implemented or tested. | Replace it with "Save Warning as Draft" and "Cancel Warning", which the class diagram and wireframe already imply (CL2, UI1). |
| UC2 | Nothing connects warnings to verified hazard reports, though Submit and Verify's postcondition says a verified report "can be used to support disaster warning". | The two use cases do not meet; the officer retypes what a report already says. | Add "Issue Warning from Verified Report", extending Issue Hazard Warning. |
| UC3 | "Retry Failed Channel" and "Review Dissemination Status" are scenario steps with no use case. Citizens only "Receive Hazard Warning". | The scenario's retry and the citizen's acknowledgement have no place in the model. | Add "Retry Failed Channel" (extends Disseminate), "Acknowledge Warning" and "Register Alert Area" (citizen). |
| CL1 | WarningStatus and WarningLevel are used but never defined. Channel type and channel status are plain strings. | Any text can be stored; the scenario's statuses (Partially Disseminated, Pending Dissemination) are not in the model. | Enumerations: WarningLevel (CRITICAL, HIGH, MEDIUM, LOW), WarningStatus (DRAFT, DISSEMINATING, DISSEMINATED, PARTIALLY_DISSEMINATED, PENDING_DISSEMINATION, CANCELLED), ChannelKind (PUSH, SMS, AUDIBLE), ChannelState (PENDING, SENT, FAILED, SKIPPED). |
| CL2 | HazardWarning has markAsCancelled() and DutyOfficer has cancellingWarning(), but no flow cancels a warning. The wireframe has "Save as Draft" but there is no draft state. | Methods without flows are dead design; the draft button does nothing. | Add DRAFT and CANCELLED statuses, cancel reason and time, and the flows that use them. |
| CL3 | HazardWarning has a single affectedDistrict, but the wireframe selects several districts. No valid period, no safety instructions, no link to a source report. | The class cannot hold what the screen collects. | districts: District[], validFrom, validUntil, safetyInstructions: String[], sourceReportId, reference, clientRequestId (stops a double click issuing twice). |
| CL4 | The sequence diagram has a Warning Controller, but the class diagram has no controller, service, repository or channel classes for this use case. Other use cases have them. | The diagrams disagree, and there is no class to hold the rules. | Add HazardWarningController, HazardWarningService, HazardWarningRepository, WarningDisseminator, NotificationChannel (interface) with InAppPushChannel, SmsChannel, AudibleAlertChannel, and CitizenDirectory. |
| CL5 | AlertDelivery has only deliveryId and deliveryStatus, with no link to the citizen's acknowledgement. AffectedCitizen has no district to match against. | Recipients cannot be found by district, and nobody can tell who acknowledged. | AffectedCitizen gets deviceId and district. AlertDelivery gets warningId, deviceId (the citizen's registered device, unique per citizen), deliveredAt, acknowledgedAt. |
| SQ1 | The UI calls Hazard Information and Location Management directly, and validates the warning level on the controller before the warning exists. | Rules sit in the screen and are skipped by any other caller. | UI calls the controller; HazardWarningService validates (UI also checks for instant feedback). |
| SQ2 | The officer's confirmation never reaches a service; createWarning goes from UI straight to the controller, which saves and disseminates itself. | No layer owns the rules or the transaction. | Controller to Service to Repository; the service calls WarningDisseminator after the warning is stored. |
| SQ3 | Only "at least one succeeds" and "all fail" are drawn. No alt for partial success, no retry, no "no citizens", no database failure, no invalid input, no duplicate. | The scenario lists these, but the diagram does not show what happens. | Add alt fragments for each, and a separate Retry and a Cancel sequence. |
| SQ4 | Channels are an opt fragment with three guards, so at most one runs. The scenario sends on all channels at once. | The diagram contradicts "simultaneously where applicable". | A par fragment over the three channels; each result is recorded separately. |
| SC1 | "No Citizens Found" ends with the warning stored but no decision about sending. | The officer is left with a stored warning in an unknown state. | Show the count on the review screen before anything is stored; the officer goes back to change the area or confirms. |
| SC2 | The precondition says hazard information "must be available", but the warning is only text the officer types. | The retrieve step has no defined source. | The hazard information comes from a VERIFIED hazard report when the officer starts from one (UC2). Without one, the officer enters it. |
| UI1 | "Issue Warning" on screen 1 actually opens a review step. | The button label does not say what happens next. | Rename it "Review Warning", as IT23733794 did with "Review report". |
| UI2 | The portal form has no field for the safety instructions the phone shows. | The phone shows text nobody entered. | Add a numbered Safety Instructions list to the form. |
| UI3 | Mobile screens 4 ("Hazard Warning") and 5 ("Hazard Alert") are identical. | One screen is redundant; there is no list of warnings. | Screen 4 becomes the Alerts list; screen 5 is the detail. |
| UI4 | There is no way to stop a warning or tell citizens it is over. | Citizens keep acting on a finished hazard. | Cancel Warning on the status page (reason required) sends an All Clear; the phone shows it. |
| UI5 | The citizen never tells the app where they live, so "citizens in the affected area" cannot be found. | Targeting by district has no data. | Profile tab: district and optional phone number for SMS. |
| UI6 | "Draw on Map" freehand drawing does not map to a district, which is what the scenario targets. | A drawn shape cannot be checked against "a valid district". | The map shows the selected districts as circles coloured by level; clicking toggles the nearest district. |
| UI7 | The confirm step does not warn that the warning cannot be recalled, and a duplicate active warning is not detected. | Mistakes reach thousands of citizens. | Confirm dialog states the recipient count and that it cannot be recalled. A duplicate active warning (same hazard type, overlapping district) shows a banner and needs "Issue anyway". |

## Domain Model

### HazardWarning (`hazard_warnings`)

| Field | Type | Notes |
|---|---|---|
| id | ObjectId | |
| reference | string, unique | `HW-2026-0007`, from the existing `Counter` model with a separate key |
| clientRequestId | string, unique | Sent by the portal on create; a replay returns the existing warning |
| hazardType | HazardType | Reuses `HAZARD_TYPES` from `@repo/types` |
| level | WarningLevel | CRITICAL, HIGH, MEDIUM, LOW |
| description | string | 10-1000 characters |
| additionalInfo | string? | up to 500 |
| safetyInstructions | string[] | 1-8 items, each 3-200 characters; required to issue, optional in a draft |
| districts | District[] | 1-25, unique; from the fixed list of 25 districts |
| validFrom, validUntil | DateTime | validUntil after validFrom; validUntil in the future to issue |
| sourceReportId | ObjectId? | Set when issued from a verified report |
| status | WarningStatus | |
| channels | DisseminationStatus[] | Embedded, one per ChannelKind |
| createdBy, issuedBy | string | Officer name from `x-officer-name` |
| issuedAt | DateTime? | |
| cancelledAt, cancelledBy, cancelReason | | cancelReason 5-300 characters |
| createdAt, updatedAt | DateTime | |

Indexes: `[status, createdAt]`, `[districts, status]`.

A draft may be saved with only hazardType, level and at least one district; the other fields are checked when it is issued.

### DisseminationStatus (embedded)

`channel` ChannelKind, `state` ChannelState, `recipients` int, `delivered` int, `attempts` int, `lastError` string?, `sentAt` DateTime?.

Overall status after a send or retry:

- every channel SENT or SKIPPED (and at least one SENT): DISSEMINATED
- at least one SENT and at least one FAILED: PARTIALLY_DISSEMINATED
- no channel SENT: PENDING_DISSEMINATION

SKIPPED means the channel had no recipients (for example no citizen in the area gave a phone number for SMS).

### NotificationLog (`notification_logs`)

`warningId`, `channel`, `outcome` (SENT or FAILED), `message`, `recipients`, `createdAt`. One row per channel attempt, including All Clear sends. Feeds Live Delivery Activity. Index `[warningId, createdAt]`.

### AffectedCitizen (`citizens`)

`deviceId` (the existing reporter UUID, unique), `district`, `phone?` (Sri Lankan mobile, `+947XXXXXXXX` or `07XXXXXXXX`, stored normalized as `+947...`), `updatedAt`. Index `[district]`.

### AlertDelivery (`alert_deliveries`)

`warningId`, `deviceId` (identifies the citizen: unique in `citizens`), `deliveredAt`, `acknowledgedAt?`. Unique `[warningId, deviceId]`, so a retry never delivers twice.

### Lifecycle

```
DRAFT --issue--> DISSEMINATING --> DISSEMINATED
                               \-> PARTIALLY_DISSEMINATED --retry--> DISSEMINATED / PARTIALLY_DISSEMINATED
                               \-> PENDING_DISSEMINATION  --retry--> any of the three
DISSEMINATING / DISSEMINATED / PARTIALLY_DISSEMINATED / PENDING_DISSEMINATION --cancel--> CANCELLED
```

- A warning is active when its status is not DRAFT or CANCELLED and `validUntil` has not passed. Expiry is computed on read; no background job.
- Every status change is a conditional update (`updateMany where { id, status in [...] }`), the same pattern as report decisions. A count of 0 means 409 (state changed) or 404.
- Only DRAFT can be edited or deleted. Retry is allowed only from PARTIALLY_DISSEMINATED or PENDING_DISSEMINATION, and only re-runs FAILED channels.
- Cancel sends an All Clear through the same channels to the same recipients; its outcome is logged but does not block the cancel.

## API (`apps/api`, prefix `/api`)

### Modules

- `hazard-warnings/`: controller, service, repository interface and Prisma implementation, DTOs, mapper, `dissemination/` (WarningDisseminator, NotificationChannel token and the three channels), `districts` validation.
- `citizens/`: controller for `/citizens/me` and `/alerts/*`, CitizenService, CitizenDirectory (recipients by district), repositories for citizens and alert deliveries.
- `HazardReportsModule` already exports its repository; the warnings service uses it for prefill.

### Channels (Strategy pattern)

```ts
interface NotificationChannel {
  readonly kind: ChannelKind;
  send(message: ChannelMessage, recipients: Recipient[]): Promise<ChannelResult>;
}
```

- `InAppPushChannel` (real): upserts AlertDelivery rows; delivered = rows written.
- `SmsChannel` (simulated gateway): recipients with a phone; SKIPPED when none.
- `AudibleAlertChannel` (simulated): one activation per district; recipients = number of districts.
- `SIMULATE_CHANNEL_FAILURE` env (comma list of SMS, AUDIBLE, PUSH; empty by default) makes those channels throw, to demonstrate partial and pending dissemination.
- WarningDisseminator runs channels with `Promise.allSettled`, so one throwing never stops the others, writes a NotificationLog row per channel, and returns the statuses.

### Endpoints

| Method and path | Caller | Result |
|---|---|---|
| `POST /hazard-warnings/preview` | officer | Validates the details for issue. Returns `{ recipients: { total, byDistrict, withPhone }, duplicates: WarningSummary[] }`. Stores nothing. |
| `POST /hazard-warnings` `{ ...fields, clientRequestId, action: 'DRAFT' or 'ISSUE', force? }` | officer | 201 with the warning. ISSUE stores then disseminates. 409 `DUPLICATE_ACTIVE_WARNING` unless `force`. |
| `PATCH /hazard-warnings/:id` | officer | Edit a DRAFT. 409 if not a draft. |
| `DELETE /hazard-warnings/:id` | officer | Delete a DRAFT. |
| `POST /hazard-warnings/:id/issue` `{ force? }` | officer | Issue a DRAFT. |
| `POST /hazard-warnings/:id/retry` | officer | Re-run FAILED channels. 409 if nothing to retry. |
| `POST /hazard-warnings/:id/cancel` `{ reason }` | officer | CANCELLED plus All Clear. 409 if already cancelled or a draft. |
| `GET /hazard-warnings?view=active,drafts,past&page&limit` | officer | Paginated summaries. |
| `GET /hazard-warnings/stats` | officer | `{ active, drafts, issuedToday }` for the sidebar badge. |
| `GET /hazard-warnings/prefill?reportId=` | officer | `{ hazardType, district, description, sourceReportId, reportReference }`. 404 unknown, 400 if not VERIFIED. |
| `GET /hazard-warnings/:id` | officer | Detail with channels and the latest 50 logs. |
| `PUT /citizens/me` `{ district, phone? }` | citizen | Upsert; returns the profile. |
| `GET /citizens/me` | citizen | Profile or 404. |
| `GET /alerts/mine` | citizen | Warnings **delivered to this device** that are active, plus those cancelled or expired in the last 7 days, each with `acknowledgedAt`. The delivery row is the in-app push, so a citizen who registers after a warning was sent does not receive it, as with any push. |
| `POST /alerts/:warningId/acknowledge` | citizen | Sets acknowledgedAt (idempotent). 404 if the warning was not delivered to them. |

Static routes (`preview`, `stats`, `prefill`) are declared before `:id`, as in the reports controller.

### Error behaviour

| Situation | Response | Shown to the officer |
|---|---|---|
| Missing or invalid fields, unknown district, bad period | 400 with field messages | Field errors; "Please provide valid warning details before issuing the warning." |
| Duplicate active warning | 409 `DUPLICATE_ACTIVE_WARNING` with the matches | Banner, "Issue anyway" checkbox |
| No registered citizens | preview total 0 | "No registered recipients found for the selected area." Issue is still allowed (sirens still sound) |
| Every channel fails | 201, status PENDING_DISSEMINATION | "Notification service is temporarily unavailable." Retry button |
| Some channels fail | 201, PARTIALLY_DISSEMINATED | Failed card in red with Retry |
| Database failure | 500 (existing filter) | "Warning could not be saved. Please try again." Form kept |
| Network lost in the portal | client error | "Connection lost." Form and review state kept |
| Source report not verified | 400 | "Only verified reports can be escalated to a warning." |
| State changed by another officer | 409 | Message and the page reloads the current state |

## Shared Contract (`packages/types/src/hazard-warning.ts`)

`WARNING_LEVELS`, `WarningLevel`, `WARNING_LEVEL_LABELS`, `WARNING_STATUSES`, `WarningStatus`, `WARNING_STATUS_LABELS`, `CHANNEL_KINDS`, `ChannelKind`, `ChannelState`, `DISTRICTS` (25 names with centre coordinates), `District`, `WARNING_LIMITS`, `HazardWarningDto`, `WarningSummaryDto`, `DisseminationStatusDto`, `NotificationLogDto`, `WarningFields`, `CreateWarningInput`, `WarningPreview`, `WarningPrefill`, `WarningStats`, `CitizenProfileDto`, `RegisterCitizenInput`, `CitizenAlertDto`. The stub `alert.ts` is removed; its only user (mobile Home) moves to `CitizenAlertDto`.

## DMC Portal (`apps/web`)

Sidebar entries (via `navItems.ts`): Issue Warning, Warnings (badge: active count).

1. **Issue Hazard Warning** (`/warnings/new`, `/warnings/:id/edit`, `/warnings/new?fromReport=:id`). Left card: Hazard Type, Warning Level (four coloured toggle buttons), Description, Additional Information, Safety Instructions (add, edit, remove rows), Affected Districts (chips with search), Valid Period. Buttons: Save as Draft, Review Warning. Right card: Leaflet map with a circle per selected district coloured by level, clicking toggles the nearest district, selected district chips, level legend. Prefill banner when started from a report.
2. **Review Warning** (`/warnings/review`, state in router state; going there directly redirects to the form). Summary card as in the wireframe, Total Citizens in Area box with per-district breakdown and the SMS count. Banners for no recipients and duplicates. Back keeps entries, Cancel discards after a confirm, Confirm Warning opens ConfirmDialog with the count and "cannot be recalled".
3. **Dissemination Status** (`/warnings/:id`). Progress bar, three channel cards with Retry on FAILED, Live Delivery Activity, Warning Overview, Cancel Warning dialog (reason required). Polls every 3 s while DISSEMINATING. Banners for partial and pending.
4. **Warnings list** (`/warnings`): Active, Drafts, Past tabs using the existing table and pagination.
5. **ReviewReportPage**: VERIFIED reports show "Issue Warning from this report".

Level colours: Critical `danger`, High `orange`, Medium amber, Low `success`, all as theme tokens (add `level-*` tokens to `index.css` and `theme.ts`, and to the style guide).

## Citizen App (`apps/mobile`)

- **Profile tab**: Alert Area, district list (25 entries fit one scrolling sheet), optional phone, Save. Explains why the district is needed.
- **Alerts tab** (screen 4): active warnings first as level-coloured cards, then All Clear and expired ones greyed. Prompt card linking to Profile when no district is set.
- **Hazard Alert** (screen 5, stack): title and level badge, districts, issued and valid until, description, numbered safety instructions, View Map (opens the maps app at the district centre via `Linking`), Acknowledge Warning (then Safety Info). Cancelled warnings show the All Clear banner and reason, no acknowledge.
- **Safety Info** (screen 6): Alert Acknowledged, emergency contacts 117 / 119 / 110 as `tel:` links, the safety instructions, Back to alerts.
- **Home**: status card turns to the highest active level; Recent Alerts shows the latest two; bell counts unacknowledged active warnings plus unread report results.
- `useAlerts` polls `/alerts/mine` on focus and every 30 s, caches the last result in AsyncStorage, and shows an offline banner with the cached list.

## Testing

Target: statement coverage above 90% on the new code, and the existing 80% gates stay green.

- API (Vitest): service flows (draft, issue, replay, duplicate and force, validation, all sent, partial, all failed, no recipients, retry only failed, retry when nothing failed, cancel and All Clear, cancel race, prefill verified, prefill pending, prefill unknown, expiry), disseminator (a throwing channel does not stop others, logs per channel, overall status rules), each channel, DTO validation, repository with mocked Prisma, one integration test on `dws_test` for conditional transitions and the delivery unique index, controllers and guards, one e2e (register, issue, list mine, acknowledge).
- Web (Vitest + RTL): form validation and level toggle, safety instruction rows, draft save, prefill banner, review count and banners, confirm dialog, status cards and retry, cancel requires a reason, list tabs, loading, empty and error states, axe check.
- Mobile (Jest + RNTL): profile validation and save, alerts ordering, detail and acknowledge, All Clear view, Safety Info contacts, Home status card and bell, offline cache.

## Deliverables

1. Code on branch `feat/hazard-warning-issue-disseminate`, merged by PR like the teammate's.
2. Critique document in the same structure as IT23733794's: findings table (above), revised sequence diagram as an editable `.drawio` file with changes in orange and tagged by finding ID, implemented UI screenshots with the flow, and the AI prompts appendix.

## Done When

- An officer can save a draft, issue a warning (directly, from a draft, or from a verified report), see each channel's status, retry failed channels, and cancel with an All Clear.
- A citizen who set a district sees the warning, opens it, acknowledges it, sees Safety Info, and later sees the All Clear.
- Every finding UC1-UI7 is in the code and in the critique document.
- `bun run check-types`, `bun run lint`, `bun run test` are green, with coverage above the target.
