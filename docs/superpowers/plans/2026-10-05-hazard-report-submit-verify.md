# Submit and Verify Hazard Report: Implementation Plan

Use case owner: IT23857308. Source: `docs/superpowers/misc/Group_052.pdf` (pp. 32-41) and `SE3070 Case Study Assignment 02 Specification.pdf`.

## Goal

Implement the full "Submit and Verify Hazard Report" use case end to end: Nest API on MongoDB Atlas, citizen mobile screens (Expo), and the DMC Portal for the Duty Officer (Vite web). The UI follows the report's wireframes plus the justified fixes below. Those same fixes must go into the group report (revised use case scenario, sequence diagram, class diagram, wireframes), because the spec requires the implementation to follow the report's changes exactly.

## Scope and Grading Constraints

- Excluded: login, logout, and admin privilege granting (not graded). Identity is stubbed (see Decisions).
- Quality over breadth: every unit gets meaningful tests, with a target of at least 80% coverage on the code written for this use case.
- Rubric weights: implementation accuracy 30, code quality 20 (SOLID, patterns, no smells), unit tests 20.
- Work order: API first, then shared types, then web, then mobile.

## Design Changes (Critique Findings to Implement and to Add to the Report)

| # | Finding in original design | Change (report and code) |
|---|---|---|
| C1 | Sequence diagram: `HazardReport` entity validates and calls the dashboard; controller and entity responsibilities are mixed. | Controller, then `HazardReportService` (validation and orchestration), then `HazardReportRepository`. Entity holds state only. Redraw the sequence diagram. |
| C2 | Sequence diagram has no alt for invalid input, GPS failure, offline, or system error, though the scenario lists them. | Add alt fragments for each exception flow, and a "Check Submission Status" sequence. |
| C3 | Rejection notification originates from `HazardReport`, not `Notification service`. | `HazardReportService` calls `NotificationService` on both verify and reject. Reason is passed to the notification. |
| C4 | Class diagram has no status enum and no offline concept. | `ReportStatus`: PENDING_SYNC (client only), PENDING_VERIFICATION, VERIFIED, REJECTED. Add `RejectionReason`, `clientRequestId` (idempotent sync), and a `Notification` linked to a report. |
| C5 | No "My Reports / Check Submission Status" screen. | New mobile screen: list of own reports with status chips, and a detail view. |
| C6 | No rejected-result screen for the citizen. | New mobile "Report Rejected" screen showing the reason and a "Submit a new report" action. |
| C7 | No offline, GPS-failed, or validation-error UI states. | Offline banner and queued state (PENDING_SYNC, auto-sync on reconnect). GPS retry and "Open settings" action. Inline field errors. |
| C8 | Form banner says "call 911"; Sri Lanka uses 117 (DMC), 119, 110. | Banner says "call 117 (DMC) / 119 / 110". |
| C9 | Low-fi and hi-fi wireframes disagree. The "Next" button hides that it leads to a review step. Photo has no preview or remove. | Button reads "Review report". Photo preview with a remove action. Required markers on all required fields. Edit-back from Review keeps entered data. |
| C10 | Officer review: reject reason is only a visual dropdown, no confirmation, and the decision is undoable by double submit. | Reason is required when rejecting (enum plus free-text details). Confirmation dialog. The server enforces a single decision (409 if already decided). |
| C11 | Pending list has no filter, sort, or triage. | Filter by hazard type, sort by oldest or newest, and an "age" highlight on reports older than 30 minutes. |
| C12 | The officer cannot find a report that has already been decided. | Verified and Rejected reports pages reuse the same list with a status filter. |

## Decisions

- **Database:** MongoDB Atlas accessed through **Prisma** (`prisma` and `@prisma/client`, `provider = "mongodb"`). Connection string from `DATABASE_URL` (never committed). Confirm the installed Prisma major version supports MongoDB before building on it (T2). Prisma has no migrations for MongoDB, so schema changes use `prisma db push`. IDs are `@id @default(auto()) @map("_id") @db.ObjectId`. A `PrismaService` (extends `PrismaClient`, connects in `onModuleInit`, disconnects on shutdown) is injected into the repository only, so services never touch Prisma directly.
- **API conventions:** global prefix `/api`, `ValidationPipe` (whitelist, forbidNonWhitelisted, transform) with `class-validator` DTOs, a global exception filter with one error shape, config module (`@nestjs/config`, validated env), and Swagger docs at `/api/docs`.
- **Layering and patterns:** Controller, then Service, then Repository (interface plus Mongoose implementation, injected by token). `PhotoStorage` interface with a `CloudinaryPhotoStorage` implementation so storage can be swapped and mocked in tests. `NotificationService` interface, with an in-app notification collection that the mobile app polls (no push in scope).
- **Identity stub:** the mobile app generates a persisted `reporterId` (UUID) sent as the `x-reporter-id` header. Officer endpoints are guarded by an `OfficerGuard` that checks the `x-officer-key` header against `OFFICER_API_KEY`. This is a stand-in, not authentication.
- **Document storage (Cloudinary):** photo evidence is stored in Cloudinary with the official `cloudinary` SDK. Multer uses memory storage, and the buffer goes up through `uploader.upload_stream` into the `hazard-reports/` folder. The database stores only `{ publicId, secureUrl, width, height, bytes }` per photo. Credentials come from `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` (never committed). If saving the report fails after an upload, the service deletes the uploaded assets by `publicId` so no orphans remain. Clients render `secureUrl` directly (thumbnails use Cloudinary URL transforms), so the API has no file-serving endpoint.
- **Concurrency:** verify and reject use a conditional `updateMany({ where: { id, status: PENDING_VERIFICATION }, data })`. A result with `count === 0` means the report was already decided, and the service returns 409 (or 404 if the id does not exist).
- **Idempotent sync:** `clientRequestId` has a `@unique` constraint, and a repeated POST returns the existing report (a unique-violation `P2002` is caught and resolved to a lookup). This makes offline replay safe.
- **Shared contract:** all DTO shapes, enums, and status unions live in `@repo/types` and are consumed by api, web, and mobile.
- **Package manager:** Bun (`bun add`, `bun run`). Do not hand-edit lockfiles.

## API Surface (`apps/api`, prefix `/api`)

| Method and path | Caller | Purpose |
|---|---|---|
| `POST /hazard-reports` (multipart: type, description, latitude, longitude, clientRequestId, photos[]) | citizen | Create report as PENDING_VERIFICATION. 201, or 200 with the existing report if replayed. |
| `GET /hazard-reports/mine` | citizen | Own reports (by `x-reporter-id`), newest first. |
| `GET /hazard-reports/:id` | citizen (own) or officer | Report detail. |
| `GET /hazard-reports?status&type&sort&page&limit` | officer | Paginated list. |
| `GET /hazard-reports/stats` | officer | Counts: pending, verified today, rejected, total. |
| `PATCH /hazard-reports/:id/verify` `{notes?}` | officer | PENDING to VERIFIED, records the decision, notifies. |
| `PATCH /hazard-reports/:id/reject` `{reason, details?, notes?}` | officer | PENDING to REJECTED, records the decision, notifies. |
| `GET /notifications` and `PATCH /notifications/:id/read` | citizen | Result notifications. |

Photo evidence is returned as Cloudinary `secureUrl` values inside the report payload.

## UI Style Guide (Follow the Report's Hi-Fi Wireframes)

Both UIs must reuse the visual language of the hi-fi wireframes in the report (pp. 38-41), so the screens read as one product. Define these once as tokens (Tailwind theme in `apps/web/src/index.css`, a `theme.ts` in `apps/mobile/src`) and never hard-code colors in components.

| Token | Value (sampled from the wireframes, confirm against the PDF) | Use |
|---|---|---|
| `navy` | deep navy (about `#14305a`) | App bars, portal sidebar, "Go to Home" and "View Report" buttons |
| `orange` | orange (about `#e8821e`) | Primary call to action: Report a Hazard, Review report, Submit Report, Refresh, "View" links |
| `success` | green | Verify button, Verified state, Safe status |
| `danger` | red | Reject button, Rejected state, Critical |
| `warning` | amber and pale-yellow banners | Pending Verification badge, review banner, emergency-number banner |
| `surface` | white cards on light gray page background | Cards with a thin border and rounded corners |

- **Typography:** one sans-serif family (Inter or the platform default). Bold screen titles in the app bar, small uppercase labels for section headers (as in HAZARD TYPE, DESCRIPTION, PHOTO, LOCATION), and red asterisks on required labels.
- **Mobile layout:** navy app bar with a back arrow and a centered title. Full-width rounded buttons pinned at the bottom of the screen. Result screens use a centered card with a large circular status icon, a short heading, one line of copy, and a status badge.
- **Portal layout:** navy left sidebar (Dashboard, Pending Reports with a count badge, Verified Reports, Rejected Reports, and so on), a top bar with the notification bell and an "On duty" officer chip, four stat cards above the table, and a numbered review layout (1 Report Details, 2 Location, 3 Photo Evidence, 4 Officer Notes, 5 Decision).
- **Status chips:** the same color and label everywhere. Pending Verification is amber, Verified is green, Rejected is red, Pending Synchronization is gray.
- **Consistency check:** each screen built must be compared side by side with its wireframe. Only the C1-C12 changes may differ from it.

## Tasks

Dependencies run top to bottom. Tasks 1-7 are the API, which is the starting point.

- [ ] **T1 Shared contract.** In `packages/types/src`, add `hazard-report.ts` (HazardType, ReportStatus, RejectionReason, HazardReportDto, CreateHazardReportInput, DecisionInput, ReportStats, NotificationDto, Paginated<T>). Export from `index.ts`, and extend `contract.test-d.ts` with `@ts-expect-error` cases. → Verify: `bun run check-types` is green in all workspaces.
- [ ] **T2 API foundation.** Install `@nestjs/config @prisma/client class-validator class-transformer @nestjs/swagger cloudinary multer` (dev: `prisma @types/multer`). Run `bunx prisma init --datasource-provider mongodb`. Add a validated `AppConfigModule` (DATABASE_URL, OFFICER_API_KEY, PORT, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET), a global `PrismaModule` and `PrismaService`, global prefix, `ValidationPipe`, and `HttpExceptionFilter`. Update `main.ts` and `app.module.ts`, and add `.env.example`. → Verify: `bunx prisma validate` passes, `bun run start:dev` connects to Atlas, and `curl localhost:3000/api/health` returns 200.
- [ ] **T3 Domain and repository.** In `prisma/schema.prisma`, define `HazardReport` (status enum, rejection reason, decision metadata, embedded `Location` and `Photo[]` composite types, `clientRequestId @unique`, `@@index([reporterId])`, `@@index([status, createdAt])`) and `Notification`. Run `bunx prisma generate` and `bunx prisma db push`. Create `hazard-reports/` with a `HazardReportRepository` interface and token, and `PrismaHazardReportRepository` (create, findById, findMine, list with filters and pagination, stats, `decide()` conditional transition). → Verify: unit tests with a mocked `PrismaService`, plus one integration test against a separate Atlas test database (or `MongoMemoryReplSet`, since Prisma needs a replica set) for the unique constraint and the conditional transition.
- [ ] **T4 Submit use case.** Create `CreateHazardReportDto` (type enum, description 10-1000 chars, lat/lng ranges), `PhotoStorage` plus `CloudinaryPhotoStorage` (memory-storage multer, jpeg/png/webp only, max 5 files, 5 MB each, upload to `hazard-reports/`, delete by `publicId`), and `HazardReportService.submit()` with idempotent replay. Add `POST /hazard-reports` and `GET /hazard-reports/mine`. → Verify: Vitest cases (Cloudinary SDK mocked) cover valid submit, missing field (400), bad coordinates (400), oversize or wrong-type photo (400/415), replayed `clientRequestId` (same report returned, no second upload), upload failure (no record created), and a database failure after upload (uploaded assets deleted). One manual check: a real submit shows the image in the Cloudinary media library.
- [ ] **T5 Verify and reject use cases.** Create `OfficerGuard`, `DecideReportDto`, and `RejectReportDto` (reason enum required; details required when reason is OTHER). Add `HazardReportService.verify()` and `reject()`, which call the repository's `decide()` and then `NotificationService.notifyDecision()`. Add `GET /hazard-reports` (list), `/stats`, and `/:id`. → Verify: Vitest cases cover verify, reject, already-decided (409), unknown id (404), a missing or wrong officer key (401), and a notification failure that does not roll back the decision (logged, retried by sync).
- [ ] **T6 Notifications.** Create the `Notification` schema, `NotificationService` (create on decision, list by reporter, mark read), and the two endpoints. → Verify: unit tests, and `curl` after a verify returns one unread notification for that reporter.
- [ ] **T7 API verification gate.** Run `bun run test --coverage` in `apps/api`, and add an e2e test (`supertest`, the Atlas test database, and a fake `PhotoStorage`) for submit, officer list, verify, citizen notification. → Verify: coverage is at least 80% on `hazard-reports/` and `notifications/`, and the e2e test passes.
- [ ] **T8 DMC Portal (`apps/web`).** Add a `DashboardLayout` (sidebar, officer chip), a Pending Reports page (stat cards, table, type filter, sort, age highlight, pagination, Refresh), a Review Report page (details, Leaflet map, photo gallery, notes, Verify, Reject with required reason and a confirm dialog, 409 handled with a clear message), and Verified and Rejected list views. Use an `api/hazardReports.ts` client typed from `@repo/types`, and add routes in `App.tsx`. Define the Tailwind theme tokens from the UI Style Guide first, then style every page to match hi-fi wireframes 6 and 7. → Verify: RTL tests cover the list render, filter and sort, reject-without-reason blocked, confirm dialog, 409 message, and loading, empty, and error states. `bun run dev` shows the pending list against the local API.
- [ ] **T9 Citizen app: submit flow (`apps/mobile`).** Add `@react-navigation/native-stack`, `expo-location`, `expo-image-picker`, `@react-native-async-storage/async-storage`, and `@react-native-community/netinfo`. Create `src/theme.ts` from the UI Style Guide first, then build Home, Report Hazard (matching hi-fi wireframes 1-5, with C8 and C9 fixes, GPS retry and settings action, inline errors), Review Report (edit-back keeps state), and Report Submitted. Add an offline queue: persist the report and mark it PENDING_SYNC, then replay with the same `clientRequestId` on reconnect. → Verify: jest tests cover form validation, GPS failure state, offline queueing, and sync replay (hook and queue unit tests plus screen tests). The iOS simulator shows the full flow.
- [ ] **T10 Citizen app: results and status.** Build My Reports (status chips, pull to refresh), Report Detail, Report Verified, and Report Rejected (shows the reason), and poll notifications on focus. → Verify: jest tests cover each status render and the notification-to-screen mapping. The simulator shows a report moving to Verified or Rejected after an officer decision in the web portal.
- [ ] **T11 Phase X: Verification (last).** Run `bun run check-types && bun run lint && bun run test` at the root, then check each of the following. → Verify: all green. 80% or more coverage on the API and on the feature code in web and mobile. Manual pass: every main, alternate, and exception flow in the revised scenario. Screens match the wireframes plus C1-C12.
- [ ] **T12 Report sync.** Update the group-report sections for this use case: the revised scenario, sequence diagrams (C1-C3), class diagram (C4), wireframes (C5-C12), and the written critique with justifications. → Verify: every change in the table above appears in both the report and the code.

## Done When

- [ ] A citizen can submit a report (online or offline), see its status, and receive the verified or rejected result with the reason.
- [ ] A Duty Officer can list, filter, review, and verify or reject a report exactly once.
- [ ] Every row C1-C12 is implemented and documented in the report.
- [ ] Coverage is at least 80% on the code written for this use case, with lint and type checks clean.

## Risks and Notes

- Prisma and MongoDB: confirm the Prisma version in use supports the `mongodb` provider before T2 continues. If it does not, pin the latest major that does. Prisma needs an Atlas cluster (replica set), which Atlas provides, and relations on MongoDB are not enforced by the database, so the repository must keep references consistent.
- Atlas access: add the dev machine's IP to the Atlas allowlist. Keep `.env` out of git (add `.env.example` with placeholders only), and use a separate database name for tests.
- Cloudinary: free-tier limits apply. Uploads are server-side only, so the API secret is never exposed to web or mobile. Mock the SDK in all automated tests so they never hit the network.
- Notifications are in-app polling. Push is out of scope.
- Mobile on a physical device cannot reach `localhost`. Use the machine's LAN IP in `EXPO_PUBLIC_API_URL`.
- Add `docs/` plan updates as `[x]` marks when tasks finish.
