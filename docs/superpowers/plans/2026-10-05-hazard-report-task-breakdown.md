# Submit and Verify Hazard Report: Task Breakdown

Breaks every task (T1-T12) of [the implementation plan](2026-10-05-hazard-report-submit-verify.md) into small steps. Each step is one clear outcome, about 2-15 minutes, and has a way to check it. Style rules come from [`docs/style-guide.md`](../../style-guide.md) (cited as SG). Commands use Bun.

Mark `[x]` as steps finish. Commit after each numbered task with a conventional commit, scoped `api`, `web`, `mobile`, `types`, or `docs`.

## Order and Dependencies

```
T0 prerequisites
  -> T1 shared types
       -> T2 API foundation -> T3 data layer -> T4 submit -> T5 verify/reject -> T6 notifications -> T7 API gate
                                                                   |                                   |
                                                                   +-> T8 web portal (after T5)       +-> T10 mobile results (after T6)
                                                  T9 mobile submit (after T4) -+
T11 verification (after T7, T8, T10)  ->  T12 report sync
```

Critical path: T0, T1, T2, T3, T4, T5, T6, T7, T10, T11. T8 (web) can run in parallel with T6 and T9 once T5 is done. T12 can be drafted while code is built, and is finalized last.

## Change Traceability

| Change | Built in | Tested in |
|---|---|---|
| C1 service layer, entity holds state only | T3.3, T4.5, T5.3 | T4.7, T5.6 |
| C2 exception paths and status-check flow | T4.6, T9.5-T9.7, T10.1 | T4.7, T9.9, T10.6 |
| C3 notification service owns result messages | T6.2, T5.4 | T6.4, T5.6 |
| C4 status enum, rejection reason, `clientRequestId`, Notification | T1.1, T3.1 | T1.3, T3.5 |
| C5 My Reports screen | T10.1, T10.2 | T10.6 |
| C6 Report Rejected screen | T10.4 | T10.6 |
| C7 offline, GPS, validation states | T9.4-T9.8 | T9.9 |
| C8 117/119/110 banner | T9.3 | T9.9 |
| C9 button text, photo preview/remove, required marks, edit-back | T9.3, T9.4 | T9.9 |
| C10 required reason, confirm dialog, single decision | T5.2, T8.7 | T5.6, T8.9 |
| C11 filter, sort, age highlight | T8.4 | T8.9 |
| C12 verified and rejected list views | T8.8 | T8.9 |

---

## T0 Prerequisites (one-time setup)

- [x] **T0.1** Create the Atlas cluster, a database user, and allowlist the dev IP. Create two databases: `dws_dev` and `dws_test`. → Verify: `mongosh "<uri>"` connects.
- [x] **T0.2** Create the Cloudinary account and note cloud name, API key, and API secret. → Verify: the dashboard shows the Media Library.
- [x] **T0.3** Create `apps/api/.env` (git-ignored, skeleton created, you fill in the real values) with `DATABASE_URL`, `OFFICER_API_KEY`, `PORT=3000`, and the three Cloudinary variables. → Verify: `git check-ignore -v apps/api/.env` matches `.gitignore:9`.
- [x] **T0.4** Check Prisma's MongoDB support. **Result: Prisma ORM v7 does not support MongoDB yet** (the v7 docs say to use v6.19, the latest v6). The npm `latest` tags are `prisma@8.0.0-rc.20` and `@prisma/client@7.10.0`, so a plain `bun add` would pull an unsupported version. **Pin `prisma@6.19.3` and `@prisma/client@6.19.3` exactly** (no caret), with the classic `prisma-client-js` generator. → Verify: T2.1 installs the pinned versions.
- [x] **T0.5** Create branch `feat/hazard-report-submit-verify` from `dev/stoXmod` (a `dev/stoXmod/...` name would clash with the existing `dev/stoXmod` ref). → Verify: `git branch --show-current`.

## T1 Shared Contract (`packages/types`)

- [x] **T1.1** Create `src/hazard-report.ts` with `HAZARD_TYPES` and `HazardType`, `ReportStatus` (`PENDING_SYNC | PENDING_VERIFICATION | VERIFIED | REJECTED`), `REJECTION_REASONS` and `RejectionReason` (`DUPLICATE`, `INSUFFICIENT_INFORMATION`, `UNVERIFIABLE`, `OUT_OF_AREA`, `OTHER`). → Verify: file compiles.
- [x] **T1.2** Add `GeoLocation`, `HazardPhoto` (`publicId`, `secureUrl`, `width`, `height`, `bytes`), `HazardReportDto`, `CreateHazardReportFields`, `VerifyReportInput`, `RejectReportInput`, `ReportStats`, `NotificationDto`, `Paginated<T>`, `ListReportsQuery`. → Verify: file compiles.
- [x] **T1.3** Export from `src/index.ts`. Extend `contract.test-d.ts` with `@ts-expect-error` cases (invalid status, invalid reason, missing `clientRequestId`). → Verify: `bun run check-types` in `packages/types`.
- [x] **T1.4** Rebuild the package so apps see it: `bun run build` in `packages/types`. → Verify: `dist/hazard-report.d.ts` exists.
- [ ] **T1.5** Commit `feat(types): add hazard report contract`.

## T2 API Foundation (`apps/api`)

- [x] **T2.1** Install runtime deps: `bun add --exact @prisma/client@6.19.3` and `bun add @nestjs/config class-validator class-transformer @nestjs/swagger cloudinary multer`. Dev deps: `bun add -d --exact prisma@6.19.3` and `bun add -d @types/multer`. → Verify: `package.json` lists them.
- [x] **T2.2** Write `prisma/schema.prisma` by hand (datasource `mongodb`, `prisma-client-js`); `prisma init` is skipped because it rewrites `.env`. → Verify: file present.
- [x] **T2.3** Create `src/config/env.validation.ts` that validates `DATABASE_URL`, `OFFICER_API_KEY`, `PORT`, and the Cloudinary variables, and fails fast with a clear message. Add `src/config/app-config.module.ts`. → Verify: a unit test fails when a variable is missing and passes when all are set.
- [x] **T2.4** Create `src/prisma/prisma.service.ts` (extends `PrismaClient`, `onModuleInit` connects, shutdown hook disconnects) and a global `prisma.module.ts`. → Verify: unit test that `$connect` is called on init (mocked).
- [x] **T2.5** Create `src/common/filters/http-exception.filter.ts` returning `{ statusCode, error, message }`. → Verify: unit test for an `HttpException` and for an unknown error (500, no stack leaked).
- [x] **T2.6** Update `main.ts`: global prefix `api`, global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), the filter, shutdown hooks, and Swagger at `/api/docs`. Update `app.module.ts` imports. Keep the existing health route working (`API_HEALTH_PATH` is `/api/health`). → Verify: `bun run start:dev` boots.
- [x] **T2.7** Add `.env.example` with placeholder values for every variable. → Verify: no real secret in the file.
- [x] **T2.8** Run `bun run test`, `bun run lint`, `bun run check-types` in `apps/api`. → Verify: all green. `curl localhost:3000/api/health` returns 200.
- [x] **T2.9** Commit `feat(api): add config, prisma, validation, and error filter`.

## T3 Data Layer (`apps/api`)

- [x] **T3.1** Write the Prisma models in `prisma/schema.prisma`:
  - `HazardReport` with `@id @default(auto()) @map("_id") @db.ObjectId`, `reporterId`, `clientRequestId @unique`, `type`, `description`, `status`, embedded `location` (composite type) and `photos` (composite type list), decision fields (`decidedAt`, `decidedBy`, `officerNotes`, `rejectionReason`, `rejectionDetails`), timestamps.
  - `Notification` with `reporterId`, `reportId`, `kind`, `title`, `message`, `readAt`, `createdAt`.
  - Indexes: `@@index([reporterId, createdAt])`, `@@index([status, createdAt])`, `@@index([reporterId, readAt])`.
  → Verify: `bunx prisma validate`.
- [x] **T3.2** Run `bunx prisma generate` and `bunx prisma db push` against `dws_dev`. → Verify: collections and the unique index appear in Atlas.
- [x] **T3.3** Create `src/hazard-reports/domain/hazard-report.entity.ts` (plain state, no logic beyond a mapper to `HazardReportDto`) and `hazard-report.repository.ts` (interface plus `HAZARD_REPORT_REPOSITORY` token): `create`, `findById`, `findByClientRequestId`, `findByReporter`, `list(query)`, `stats(now)`, `decide(id, decision)`. → Verify: compiles.
- [x] **T3.4** Implement `PrismaHazardReportRepository`. `create` catches `P2002` on `clientRequestId` and returns the existing record. `decide` uses `updateMany({ where: { id, status: 'PENDING_VERIFICATION' } })` and returns `'DECIDED' | 'ALREADY_DECIDED' | 'NOT_FOUND'`. `list` supports status, type, sort (`oldest`/`newest`), page, and limit (max 50). → Verify: compiles and the mapper is covered in T3.5.
- [x] **T3.5** Write unit tests with a mocked `PrismaService` for: create, duplicate `clientRequestId` returns existing, findById null, list filter and pagination, stats counts, `decide` for all three outcomes. → Verify: `bun run test` green.
- [x] **T3.6** Write one integration test against `dws_test` (separate `DATABASE_URL_TEST`) covering the unique constraint and two concurrent `decide` calls (exactly one wins). Skip the test when `DATABASE_URL_TEST` is unset. → Verify: passes locally.
- [x] **T3.7** Commit `feat(api): add hazard report schema and repository`.

## T4 Submit Use Case (`apps/api`)

- [x] **T4.1** Create `dto/create-hazard-report.dto.ts` with `class-validator` rules: `type` in enum, `description` 10-1000 characters trimmed, `latitude` -90..90, `longitude` -180..180, `clientRequestId` UUID. Use `@Type(() => Number)` for multipart numbers. → Verify: DTO unit test for each rule.
- [x] **T4.2** Create `storage/photo-storage.ts` (interface and `PHOTO_STORAGE` token): `upload(file): Promise<HazardPhoto>`, `remove(publicId): Promise<void>`. → Verify: compiles.
- [x] **T4.3** Implement `storage/cloudinary-photo-storage.ts` using `cloudinary.config` from config, `uploader.upload_stream` into `hazard-reports/`, and `uploader.destroy`. Map the result to `HazardPhoto`. → Verify: unit tests with the SDK mocked: success, SDK error surfaces as `BadGatewayException`, remove delegates to `destroy`.
- [x] **T4.4** Create `storage/photo-upload.pipe.ts` (or file filter): allow jpeg, png, webp, max 5 files, 5 MB each, and configure multer memory storage in the controller via `FilesInterceptor('photos', 5, options)`. → Verify: test for wrong type (415), too large (413), too many (400).
- [x] **T4.5** Implement `HazardReportService.submit(reporterId, dto, files)`:
  1. Return the existing report if `clientRequestId` already exists (no upload).
  2. Upload photos.
  3. Create the report as `PENDING_VERIFICATION`.
  4. If create fails, remove the uploaded photos, then rethrow.
  → Verify: compiles.
- [x] **T4.6** Add `ReporterIdGuard` or decorator that reads `x-reporter-id` (UUID, 400 if missing). Add `HazardReportsController` with `POST /hazard-reports` and `GET /hazard-reports/mine`. Register `HazardReportsModule` (providers wired by token) and add Swagger decorators. → Verify: `curl -F` submit works against `dws_dev` and the image shows in Cloudinary.
- [x] **T4.7** Write service and controller tests (all mocked): valid submit, missing field, bad coordinates, wrong type, oversize, replayed id (same report, uploader not called), upload failure (no create), create failure after upload (photos removed), missing reporter header. → Verify: `bun run test` green.
- [x] **T4.8** Commit `feat(api): add submit hazard report endpoint with cloudinary photos`.

## T5 Verify and Reject Use Cases (`apps/api`)

- [x] **T5.1** Create `common/guards/officer.guard.ts` that compares `x-officer-key` to `OFFICER_API_KEY` using a timing-safe compare. → Verify: tests for missing, wrong, and correct key.
- [x] **T5.2** Create `dto/verify-report.dto.ts` (`notes?` max 500) and `dto/reject-report.dto.ts` (`reason` enum required, `details` required when `reason` is `OTHER` via a conditional validator, `notes?`). → Verify: DTO tests including the conditional rule.
- [x] **T5.3** Implement `HazardReportService.verify(id, officer, dto)` and `reject(id, officer, dto)` using `repository.decide()`. Map outcomes: `NOT_FOUND` to 404, `ALREADY_DECIDED` to 409 with a clear message. → Verify: compiles.
- [x] **T5.4** After a successful decision, call `NotificationService.notifyDecision(report, decision)`. If the notification fails, log it and still return success. → Verify: covered in T5.6.
- [x] **T5.5** Add controller routes: `GET /hazard-reports` (officer, query DTO with status, type, sort, page, limit), `GET /hazard-reports/stats`, `GET /hazard-reports/:id` (officer, or the owning reporter), `PATCH /:id/verify`, `PATCH /:id/reject`. Static `stats` and `mine` routes are declared before `:id`. → Verify: `curl` with the officer key lists, verifies, and rejects.
- [x] **T5.6** Write tests: verify, reject with each reason, reject `OTHER` without details (400), already decided (409), unknown id (404), no or wrong officer key (401), notification failure does not fail the request, reporter cannot read another reporter's report (404). → Verify: green.
- [x] **T5.7** Commit `feat(api): add officer list, verify, and reject endpoints`.

## T6 Notifications (`apps/api`)

- [x] **T6.1** Create `notifications/notification.repository.ts` (interface and token) and `PrismaNotificationRepository`: `create`, `listByReporter(reporterId, { unreadOnly })`, `markRead(id, reporterId)`. → Verify: mocked-Prisma unit tests.
- [x] **T6.2** Implement `NotificationService.notifyDecision(report, decision)` building the message: verified ("Your hazard report has been verified by the Disaster Management Centre.") and rejected (includes the reason label). Copy follows SG section 9. → Verify: unit tests for both messages.
- [x] **T6.3** Add `NotificationsController`: `GET /notifications` and `PATCH /notifications/:id/read`, reporter-scoped via `x-reporter-id`. → Verify: `curl` returns the notification after a decision.
- [x] **T6.4** Tests: create on verify, create on reject with reason, list only own, mark read (404 for another reporter's), idempotent read. → Verify: green.
- [x] **T6.5** Commit `feat(api): add decision notifications`.

## T7 API Verification Gate

- [x] **T7.1** Write `test/hazard-reports.e2e-spec.ts` with `supertest`, the `dws_test` database, and a fake `PHOTO_STORAGE` provider: submit, replay, officer list, verify, citizen notification, reject path, 409 on second decision. Add a Vitest include for e2e or a separate config and script `test:e2e`. → Verify: passes.
- [x] **T7.2** Run `bun run test --coverage` in `apps/api`. Fix gaps until `hazard-reports/` and `notifications/` are at least 80% (lines and branches). → Verify: coverage summary.
- [x] **T7.3** Run `bun run lint` and `bun run check-types`. Fix findings (no `any`, no unused code). → Verify: zero warnings.
- [x] **T7.4** Compare the generated Swagger document with the plan's API Surface table. Done as an automated e2e assertion (`documents exactly the endpoints in the plan`), so the check cannot drift. → Verify: the test passes.
- [x] **T7.5** Commit `test(api): add e2e flow and raise coverage`.

## T8 DMC Portal (`apps/web`)

- [ ] **T8.1** Add the SG section 8 `@theme` tokens to `src/index.css` and load Inter. Install icons (`bun add lucide-react`) and the map (`bun add leaflet react-leaflet` plus `-d @types/leaflet`). → Verify: a test element with `bg-navy` renders with the right computed style in the dev server.
- [ ] **T8.2** Create the API client `src/api/hazardReports.ts` (list, get, stats, verify, reject) typed from `@repo/types`. Read `VITE_API_URL` and `VITE_OFFICER_KEY`. Map non-2xx to a typed `ApiError` with the status. Accept an `AbortSignal`. → Verify: unit tests with `fetch` mocked (success, 409, network failure).
- [ ] **T8.3** Create shared components: `StatusChip` (SG 5.3), `Button` variants (SG 5.1), `Card`, `StatCard`, `Banner`, `ConfirmDialog` (SG 5.7, focus trap, Escape cancels), `EmptyState`, `Skeleton`. → Verify: one render test each (role, label, variant class).
- [ ] **T8.4** Create `DashboardLayout` (navy sidebar, count badge, bell, officer chip with "On duty") and `PendingReportsPage`: stat cards, table, type filter, newest/oldest sort, age highlight for reports older than 30 minutes, pagination, Refresh, and loading, empty, and error states. → Verify: matches hi-fi wireframe 6.
- [ ] **T8.5** Create `ReviewReportPage` layout: numbered cards for Report Details, Location (Leaflet map with marker and coordinates), Photo Evidence (main image, thumbnails, "View all photos"), Officer Notes, Decision. Shows a status chip and handles 404 and already-decided states. → Verify: matches hi-fi wireframe 7.
- [ ] **T8.6** Add the Verify action: success `Button`, call `verify`, show a success banner, return to the list, and update counts. Disable buttons while submitting. → Verify: manual click against the local API changes the status.
- [ ] **T8.7** Add the Reject action (C10): the reason select and details field are required before the Reject button is enabled (details required for `OTHER`). Clicking Reject opens `ConfirmDialog` stating the consequence. A 409 response shows "This report was already reviewed" with a link back. → Verify: tests in T8.9.
- [ ] **T8.8** Add routes in `App.tsx`: `/reports/pending`, `/reports/verified`, `/reports/rejected` (same list component with a status prop, C12) and `/reports/:id`. Sidebar links match. → Verify: each route renders the right title.
- [ ] **T8.9** Write RTL tests: list render, filter and sort change the query, age highlight, pagination, reject blocked without reason, `OTHER` needs details, confirm dialog cancel and confirm, verify success, 409 message, loading, empty, and error states. → Verify: `bun run test --coverage` at least 80% on new code.
- [ ] **T8.10** Accessibility pass (SG section 7): names on icon buttons, focus ring, dialog focus trap, keyboard-only decision flow. Run `bun run lint` and `bun run check-types`. → Verify: zero warnings.
- [ ] **T8.11** Commit in two or three steps, such as `feat(web): add theme tokens and shared components`, `feat(web): add pending reports page`, and `feat(web): add report review and decisions`.

## T9 Citizen App: Submit Flow (`apps/mobile`)

- [ ] **T9.1** Install: `bunx expo install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context expo-location expo-image-picker @react-native-async-storage/async-storage @react-native-community/netinfo expo-crypto lucide-react-native react-native-svg`. Add `EXPO_PUBLIC_API_URL` to `app.json` extra or `.env`. → Verify: app still starts.
- [ ] **T9.2** Create `src/theme.ts` (SG section 8) and shared components: `AppBar`, `PrimaryButton`, `SecondaryButton`, `FormField`, `StatusChip`, `Banner`, `ResultCard`. → Verify: render test per component.
- [ ] **T9.3** Build `HomeScreen` (hi-fi 1: status card, orange "Report a Hazard" button, recent alerts using `Alert` from `@repo/types`) and `ReportHazardScreen` (hi-fi 2): emergency banner with **117 / 119 / 110** (C8), required asterisks, "Review report" button (C9). Add navigation (`App.tsx` stack). → Verify: visual check on the simulator.
- [ ] **T9.4** Add form logic in `useHazardReportForm`: validation (type required, description 10-1000, location required), inline errors, focus to the first invalid field, and photo pick with preview, remove, and size and type limits (C9). State persists when navigating back from Review. → Verify: hook tests.
- [ ] **T9.5** Add `useLocation`: request permission, fetch the position, expose `status` (`loading | ready | denied | unavailable`) and `retry()`. Failure UI shows an explanation, "Try again", and "Open settings" (C7). → Verify: hook tests with `expo-location` mocked for each status.
- [ ] **T9.6** Build `ReviewReportScreen` (hi-fi 3): read-only summary with photo and address text, "Edit" returning to the form with data kept, "Submit report" that disables and shows "Submitting...". → Verify: screen test.
- [ ] **T9.7** Create the API client `src/api/hazardReports.ts` (`submit` with `FormData`, `listMine`) and `src/storage/reporterId.ts` (generate and persist a UUID, send as `x-reporter-id`). A `clientRequestId` UUID is generated per draft. → Verify: unit tests with `fetch` and AsyncStorage mocked.
- [ ] **T9.8** Build the offline queue `src/offline/reportQueue.ts`: if NetInfo is offline or the request fails with a network error, persist the report and photo URIs as `PENDING_SYNC`, show the queued result, and replay in order on reconnect using the same `clientRequestId`. Remove from the queue on 2xx or 200 (replay), keep and back off on 5xx, drop with a visible error on 4xx. Add the sticky offline banner (C7). Build `ReportSubmittedScreen` (hi-fi 4) with the Pending Verification or Pending Synchronization chip. → Verify: queue unit tests (enqueue, replay success, replay 4xx, replay 5xx, order).
- [ ] **T9.9** Write screen and hook tests for: validation errors, GPS denied and retry, offline submit queued, replay after reconnect, submit success, API error banner with retry. → Verify: `bun run test --coverage` at least 80% on new code.
- [ ] **T9.10** Run the full flow on the iOS simulator (online and offline by toggling network) against the local API. Fix any style drift from the wireframes. → Verify: the flow completes, and a record appears in Atlas with the photo in Cloudinary.
- [ ] **T9.11** Run `bun run lint` and `bun run check-types`. Commit in steps: `feat(mobile): add theme and shared components`, `feat(mobile): add report form and review`, `feat(mobile): add offline queue`.

## T10 Citizen App: Results and Status (`apps/mobile`)

- [ ] **T10.1** Add `listMine`, `getReport`, `listNotifications`, `markNotificationRead` to the API client. → Verify: unit tests.
- [ ] **T10.2** Build `MyReportsScreen` (C5): cards with type, short description, status chip, relative time; pull to refresh; skeleton, empty, and error states; queued reports from the offline queue appear on top as Pending Synchronization. Add a "My Reports" tab or entry from Home. → Verify: screen test for each state.
- [ ] **T10.3** Build `ReportDetailScreen`: full details, photos (render `secureUrl` with a Cloudinary thumbnail transform), location, status chip, decision time. → Verify: screen test.
- [ ] **T10.4** Build `ReportVerifiedScreen` (hi-fi 5) and `ReportRejectedScreen` (C6): reason label and details, and a "Submit a new report" button that opens the form. → Verify: screen tests.
- [ ] **T10.5** Add `useNotifications` that fetches on screen focus and app foreground, marks as read when opened, and routes a notification to the verified or rejected screen. Show an unread badge on the bell. → Verify: hook tests for mapping and marking read.
- [ ] **T10.6** Write remaining tests for status rendering, notification-to-screen mapping, and the offline-plus-server list merge. → Verify: coverage at least 80% on new code.
- [ ] **T10.7** End-to-end manual check on the simulator and the web portal: submit, officer verifies, mobile shows Verified; submit again, officer rejects with a reason, mobile shows Rejected with the reason. → Verify: both outcomes observed.
- [ ] **T10.8** Run `bun run lint` and `bun run check-types`. Commit `feat(mobile): add my reports, result screens, and notifications`.

## T11 Phase X: Verification (always last)

- [ ] **T11.1** From the repo root run `bun install`, `bun run check-types`, `bun run lint`, `bun run test`, and `bun run build`. → Verify: all green, zero warnings.
- [ ] **T11.2** Coverage check per workspace (`--coverage`): api, web, mobile. → Verify: 80% or more on the use case code. Save the summaries (text or screenshot) for the submission.
- [ ] **T11.3** Walk through every scenario in the revised use case: main flow, rejected, no evidence, check status, offline, invalid input, GPS unavailable, system error (stop the API and submit). → Verify: each behaves as written, with the right state and message.
- [ ] **T11.4** Compare each screen to its wireframe and to the SG checklist (section 13). Only the C1-C12 differences are allowed. → Verify: checklist ticked.
- [ ] **T11.5** Secret scan: `git diff main... | grep -iE "mongodb\+srv|api_secret|CLOUDINARY"` shows no real values. `.env` is untracked. → Verify: clean.
- [ ] **T11.6** Prepare the demo: seed script `prisma/seed.ts` (optional) with a few pending reports, a short run-through note in `apps/api/README.md` for env setup. → Verify: a teammate can run it from the README.

## T12 Report Sync (group report, your sections)

- [ ] **T12.1** Write the critique for this use case: for each finding C1-C12, state what the original does, why it is a problem (requirements coverage, logic, UML correctness, or HCI principle), and the evidence (page or diagram). → Verify: every C-row has an entry.
- [ ] **T12.2** Update the use case scenario text: add status-check flow, rejection reason, offline sync, and notification wording. → Verify: scenario matches the implemented behavior.
- [ ] **T12.3** Redraw the sequence diagram (C1, C3): UI, Controller, Service, Repository, Photo storage, Notification service. Add alt fragments for invalid input, GPS failure, offline, system error (C2), and a second diagram for "Check Submission Status". → Verify: the call order matches the code in T4 and T5.
- [ ] **T12.4** Update the class diagram portion (C4): `HazardReport`, `ReportStatus`, `RejectionReason`, `HazardPhoto`, `Notification`, service, repository, and storage interfaces. → Verify: names match the Prisma schema and TypeScript types.
- [ ] **T12.5** Update the wireframes (C5-C12): add My Reports, Report Rejected, offline and GPS states, form error states, confirm dialog, and filtered list. Use the same tokens as the style guide. → Verify: each new screen matches the implemented UI.
- [ ] **T12.6** Write the justification for each proposed change in one or two sentences, tied to its critique point. Do not change anything that has no justification (the spec penalizes change for its own sake). → Verify: a reviewer can trace every change to a finding.
- [ ] **T12.7** Share the style guide and token files with teammates so their wireframes and screens stay consistent. → Verify: the group has the link and acknowledges.

---

## Definition of Done (whole use case)

- [ ] Every step above is ticked, T11 passes, and T12 is merged into the group report.
- [ ] A citizen can submit (online or offline), track status, and get the verified or rejected result.
- [ ] A Duty Officer can list, filter, review, and decide each report exactly once.
- [ ] No secrets in Git, coverage at least 80%, lint and type checks clean.
