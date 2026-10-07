# Post-Disaster Analysis and Reports: Implementation Plan (fake data)

Use case owner: IT23697546. Source: `docs/Group_052.pdf` section 4 (pp. 14-21): use case scenario, sequence diagram link, storyboard, low-fi and hi-fi wireframes. (The hi-fi Resource Distribution screen was not in the pages read; it is assumed to match the low-fi one.) Same stack, conventions, and [style guide](../../style-guide.md) as the [Submit and Verify plan](2026-10-05-hazard-report-submit-verify.md).

This is a university project, so **all the data is fake and generated**. This plan is written for a branch cut from `main`, which has no warnings, shelters, resources, or events. It depends on nothing from the other use cases.

## Goal

A DMC Officer (or Donor Organisation) opens **Analysis & Reports**, picks a **completed** disaster event, chooses the scope (all affected districts, or one), and gets a **statistical post-disaster report**: the alert timeline, citizens reached, shelter occupancy over time, and resource distribution by district. Anything incomplete or still pending synchronisation is identified in the report. If generation fails, no report is shown and the officer can ask again.

## Approach: real logic, fake data

| | |
|---|---|
| **Fake (generated)** | The disaster events, the alerts issued during them, shelters and their occupancy readings, and resource distributions. A deterministic seed builder produces them, so every run gives the same data. |
| **Real** | Everything that handles the data: repositories, validation, the aggregators (timeline, reach, occupancy over time, peak, resource totals, completeness), the report API, the portal screens and charts, and the tests. |

Why this is the right call for the assignment: the grading is on implementation accuracy, code quality, and tests. A real data pipeline would need field apps and other teams' use cases that do not exist in this repo. Fake data lets the report logic be complete and demonstrable, and every flow in the scenario (including the exception flows) can be shown on demand with a prepared event.

**The fake data is labelled as fake on screen.** Every event carries `isDemoData: true` and the portal shows a small "Sample data for demonstration" notice on the events list and on the report, so nobody mistakes it for a real disaster.

**Integration path (for the report, not built).** All data is read through the `AnalysisDataRepository` port from the group class diagram (`docs/class-diagram.txt`). The seeded collections are one implementation; when the warning use case (built by another member) is merged, `findWarningsByEvent` and `countCitizensReached` get a second implementation over real `HazardWarning` and `AlertDelivery` data, and nothing else changes.

## Scope

- In: API (events list and detail, report generation), shared types, a deterministic fake-data builder and seed script, DMC Portal screens 1-5 of the wireframes (web), tests, and report/README updates.
- Out: mobile (the wireframes are portal-only), data-entry endpoints (the data arrives only by the seed; no screen or API writes shelters or resources), login and the Donor Organisation as a separate role (same officer-key stand-in as every use case), PDF/CSV export.
- Grading weights as before: implementation accuracy 30, code quality 20, unit tests 20. Target at least 80% coverage on the new code.

## What Already Exists on `main` (Reuse)

| Existing | Reused for |
|---|---|
| `HazardType` and labels in `@repo/types` | The event's hazard type. There is no Cyclone, so the demo cyclone uses **Strong Winds**. |
| `OfficerGuard`, `CallerResolver`, `HttpExceptionFilter`, repository-plus-token pattern, in-memory test repositories, `createTestApp`-style flow tests | Same structure for the new modules. |
| Web: `DashboardLayout`, `NAV_ITEMS`, `StatCard`, `StatusChip`, `Banner`, `EmptyState`, `Skeleton`, `Field`, `Pagination` (from the reports list), `useResource`, the search-param list pattern in `ReportsListPage` | Events list, KPI cards, loading and error states. |
| `packages/types/src/alert.ts` (an unused placeholder `Alert` type) | Left alone. |

Not on `main` and so built here: the district names and codes (a small list in `@repo/types`), all analysis types, shelters, resources, events.

**Merge note.** Another member built the warning use case, and their code is not on the remote yet. This branch keeps its own small `districts.ts` (code, name). When their warning branch lands, replace it with their district list if they have one (the class diagram has a `District` class with `districtId` and `districtName`). My earlier `feat/issue-disseminate-warning` branch is not part of this plan and must not be merged.

## Alignment with the Group Class Diagram

The draw.io diagram (`docs/class-diagram.txt`) already defines the post-disaster design. This plan follows it; where it deliberately differs, the reason is given.

| Class diagram | In this plan |
|---|---|
| `DisasterEvent` (`eventId`, `eventStatus`); affects 0..* `District`; includes `HazardWarning`, `ShelterOccupancyRecord`, `ResourceDistribution`; has `PostDisasterReport` | `DisasterEvent` model with `status`; its districts are `districtCodes[]`. |
| `District` (`districtId`, `districtName`); has `Shelter` | A constant list in `@repo/types` (25 fixed districts need no table); `Shelter.districtCode` is the link. |
| `Shelter` (`shelterId`, `capacity`); `ShelterOccupancyRecord` (`recordedAt`, `occupancyCount`) | Same, with the field named `occupancyCount`. |
| `Resource` (`resourceId`, `resourceName`, `resourceType`); `Organisation` (`organisationId`, `organisationName`, `organisationType`); `ResourceDistribution` (`distributionId`, `quantity`) linking a resource, an organisation, a district and an event | Three models, as drawn (the earlier draft flattened them into one record). |
| `HazardWarning` has `AlertDelivery` records received by `AffectedCitizen` | **Deviation:** a per-citizen delivery row would be thousands of fake rows with no extra logic to test. The fake data stores the aggregate per warning and district (`targeted`, `reached`). `countCitizensReached` is the port method that sums it, so a real `AlertDelivery` count can replace it. |
| `PostDisasterReport` (`reportId`, `generatedAt`, `districtIds`, `citizensReached`, `dataCompletenessStatus`; `getAlertTimeline`, `getShelterOccupancySummary`, `getResourceDistributionSummary`) | The report DTO has exactly these fields (plus the details the screens need). Not stored: built on demand. |
| `PostDisasterReportController` (`getAvailableEvents`, `requestReport`) | Same name; the two routes. |
| `DisasterAnalysisService` (`generateDisasterReport`, `analyzeDisasterEvent`, `calculateRiskLevel`, `analyzeCitizenFeedback`) | Implements `generateDisasterReport` (and the event listing). **Out of scope:** `calculateRiskLevel` and `analyzeCitizenFeedback` appear in no flow of the use case scenario or wireframes; recorded as a gap in the report rather than invented. |
| `AnalysisDataRepository` (`findCompletedEvents`, `findWarningsByEvent`, `countCitizensReached`, `findShelterOccupancyByEvent`, `findResourceDistributions`) | The repository port, with these five methods. |
| `HazardType` has no Cyclone | Settles Q1: the demo cyclone uses **Strong Winds**. |
| `RescueTeam`, `RescueAssignment`, `EmergencyResponse*` | Another use case. Not touched. |

## Design Findings (Critique of the Report, to Implement and to Add to the Report)

| # | Finding in the original design | Change |
|---|---|---|
| P1 | The scenario says "disaster events available for analysis" but the class and sequence diagrams have no event concept or lifecycle. | Add `DisasterEvent` with `status` ACTIVE or COMPLETED. Only COMPLETED events are listed (the wireframe shows only Completed). |
| P2 | "Citizens reached" is never defined. | Per alert and district the data holds *targeted* (registered citizens in the area) and *reached* (delivered). **Citizens reached** = the sum of reached over the alerts in scope; the screen also shows the reach rate against targeted. |
| P3 | "Pending synchronisation" and "incomplete" are mentioned with no rule for when a report is incomplete. | Explicit rule: **Data Incomplete** when any shelter or resource record in scope is PENDING sync, or when a section has no data. The report lists each reason with a count. Otherwise **Data Complete**. |
| P4 | The timeline wireframe labels points "Initial Alert, Escalation, District Update, Final Notice", with no rule for choosing them. | Each alert record carries its own label (it is data: the officer chose it when issuing). The timeline shows them in time order. |
| P5 | Sequence diagram has no alt fragments for the exception flows (no events, pending data, report failure). | Add alt fragments for: no completed events, specific district, pending synchronisation, generation error. |
| P6 | "Does not display an invalid report" is stated but not designed. | The service **checks the records are consistent** before calculating (negative occupancy or quantity, a reading for an unknown shelter). Any such problem, or any error, becomes one failure (503) and the page shows "Report generation failed" with Retry. Never a partial report. One demo event has bad records to show this for real. |
| P7 | The four KPI cards have no stated definitions. | Alerts issued = alerts in scope. Peak shelter occupancy = the highest **total** occupancy across in-scope shelters at one moment, and when. Districts receiving resources = distinct districts with at least one resource record in scope. |
| P8 | Charts are drawn without a text equivalent. | Every chart sits above a data table with the same numbers (the wireframes already pair them), and the timeline is also a list. |

## Decisions

- **Events.** `DisasterEvent`: `eventId` (`DE-2026-0001`), `name`, `hazardType`, `districtCodes[]`, `startedAt`, `endedAt?`, `status`, `isDemoData`, `updatedAt`.
- **Warnings.** `EventWarning` (stands in for the diagram's `HazardWarning` plus its deliveries): `eventId`, `issuedAt`, `level` (CRITICAL, HIGH, MEDIUM, LOW), `label` (INITIAL_ALERT, ESCALATION, DISTRICT_UPDATE, FINAL_NOTICE), `title`, and `districts: [{ districtCode, targeted, reached }]`.
- **Shelters.** `Shelter` (`name`, `districtCode`, `capacity`, `status` OPEN or CLOSED, `eventId`) and `ShelterOccupancyRecord` (`shelterId`, `eventId`, `occupancyCount`, `recordedAt`, `syncStatus` SYNCED or PENDING). Occupancy over time is a **step function**: a reading holds until the next one, which is what the wireframe draws.
- **Resources.** `Resource` (`resourceName`, `resourceType` WATER, FOOD, MEDICINE, SHELTER_SUPPLIES, OTHER), `Organisation` (`organisationName`, `organisationType`), and `ResourceDistribution` (`eventId`, `districtCode`, `resourceId`, `organisationId`, `quantity`, `unit`, `distributedAt`, `syncStatus`).
- **Report generation is on demand, read-only, and deterministic.** `GET /api/disaster-events/:id/report?district=CMB`. Nothing is stored.
- **Pure aggregators.** Reach, occupancy step series, peak, shelter summaries, resource totals, the consistency check, and the completeness assessment are pure functions with table-driven tests. The service only gathers data and calls them. This is where most of the unit-test value is.
- **Charts are inline SVG plus tables**, no new dependency. Step line, bar chart, and a timeline, each with an accessible text form (P8).
- **Deterministic fake data.** `buildFakeDataset()` uses a small seeded random generator (fixed seed), so names, numbers, and times are identical every run. It is a pure function, tested without a database.
- **Seed script.** `bun run seed:analysis` in `apps/api` writes the dataset to the database. It is idempotent (it removes what it created before: everything with `isDemoData: true`), and it **refuses to run** against a database whose name does not contain `dev` or `test`.
- **Authorisation.** All routes behind `OfficerGuard`.

## The Fake Dataset (each event exists to show one flow)

| Event | Hazard | Districts | Status | What it demonstrates |
|---|---|---|---|---|
| DE-2026-0001 Kelani River Flood | Flood | Colombo, Gampaha, Kalutara | Completed | **The happy path:** four alerts (Initial, Escalation, District Update, Final Notice), shelters with step occupancy, resources, all synced. Data Complete. |
| DE-2026-0002 Ratnapura Landslide | Landslide | Ratnapura, Kegalle | Completed | **Pending synchronisation:** a few occupancy and resource records are PENDING. Data Incomplete, with counts. |
| DE-2026-0003 Southern Cyclone | Strong Winds | Galle, Matara, Hambantota | Completed | **A section with no data:** alerts and resources, but no shelter records. Incomplete (no shelter data). |
| DE-2026-0004 Mahaweli Flood | Flood | Kandy, Matale, Polonnaruwa | Completed | **No resources recorded.** Incomplete (no resource data); a district with no resources when scoped to it. |
| DE-2026-0005 Puttalam Wind Event | Strong Winds | Puttalam | Completed | **Nothing recorded at all.** A valid report that is empty and incomplete in every section. |
| DE-2026-0006 Batticaloa Flood | Flood | Batticaloa, Ampara | Completed | **Generation error:** shelter readings include a negative occupancy and a reading for a shelter that does not exist. The report **fails**, shows "Report generation failed", and retries. |
| DE-2026-0007 Jaffna Flood (ongoing) | Flood | Jaffna | **Active** | **Not listed:** only completed events appear. |

Scopes to try on event 1: all districts, and each single district (checks that every number narrows correctly).

## Data Model (Prisma additions)

```prisma
enum EventStatus { ACTIVE COMPLETED }
enum AlertLevel { CRITICAL HIGH MEDIUM LOW }
enum AlertLabel { INITIAL_ALERT ESCALATION DISTRICT_UPDATE FINAL_NOTICE }
enum SyncStatus { SYNCED PENDING }
enum ShelterStatus { OPEN CLOSED }
enum ResourceType { WATER FOOD MEDICINE SHELTER_SUPPLIES OTHER }

type DistrictReach { districtCode String  targeted Int  reached Int }

model DisasterEvent {
  id String @id @default(auto()) @map("_id") @db.ObjectId
  eventId String @unique
  name String
  hazardType HazardType
  districtCodes String[]
  startedAt DateTime
  endedAt DateTime?
  status EventStatus
  isDemoData Boolean @default(false)
  updatedAt DateTime @updatedAt
  @@index([status, startedAt])
  @@map("disaster_events")
}

model EventWarning {
  id String @id @default(auto()) @map("_id") @db.ObjectId
  eventId String @db.ObjectId
  issuedAt DateTime
  level AlertLevel
  label AlertLabel
  title String
  districts DistrictReach[]
  @@index([eventId, issuedAt])
  @@map("event_warnings")
}

model Shelter {
  id String @id @default(auto()) @map("_id") @db.ObjectId
  eventId String @db.ObjectId
  name String
  districtCode String
  capacity Int
  status ShelterStatus
  @@index([eventId])
  @@map("shelters")
}

model ShelterOccupancyRecord {
  id String @id @default(auto()) @map("_id") @db.ObjectId
  shelterId String @db.ObjectId
  eventId String @db.ObjectId
  occupancyCount Int
  recordedAt DateTime
  syncStatus SyncStatus
  @@index([eventId, recordedAt])
  @@map("shelter_occupancy_records")
}

model Resource {
  id String @id @default(auto()) @map("_id") @db.ObjectId
  resourceName String
  resourceType ResourceType
  @@map("resources")
}

model Organisation {
  id String @id @default(auto()) @map("_id") @db.ObjectId
  organisationName String
  organisationType String
  @@map("organisations")
}

model ResourceDistribution {
  id String @id @default(auto()) @map("_id") @db.ObjectId
  eventId String @db.ObjectId
  districtCode String
  resourceId String @db.ObjectId
  organisationId String @db.ObjectId
  quantity Int
  unit String
  distributedAt DateTime
  syncStatus SyncStatus
  @@index([eventId, districtCode])
  @@map("resource_distributions")
}
```

## API Surface (prefix `/api`, all officer-only, read-only)

| Method and path | Purpose |
|---|---|
| `GET /disaster-events?status=COMPLETED&search&hazardType&district&page&limit` | Events for the list. The portal asks for `status=COMPLETED`. |
| `GET /disaster-events/:id` | One event (the scope screen). |
| `GET /disaster-events/:id/report?district=` | Generate the report. 404 unknown event; 409 not completed; 400 district not in the event; 503 on generation failure (including inconsistent records). |

## Report Shape (`PostDisasterReportDto`)

```
reportId, generatedAt                                    // as the class diagram
event { id, eventId, name, hazardType, districtCodes, startedAt, endedAt, isDemoData }
scope { kind: ALL | DISTRICT, districtCode? }
districtIds                                              // the district codes in scope
citizensReached                                          // also inside summary
dataCompletenessStatus: COMPLETE | INCOMPLETE
dataStatus { complete: boolean, issues: [{ kind, message, count? }] }   // the reasons
summary { alertsIssued, citizensTargeted, citizensReached, reachRate,
          peakShelterOccupancy { value, at, capacity } | null, districtsReceivingResources }
alertTimeline [{ id, at, level, label, title, targeted, reached }]
shelters [{ shelterId, name, districtCode, capacity, peakOccupancy, latestOccupancy, status }]
occupancyTotalSeries [{ at, occupancy }]                 // the step chart
resources [{ districtCode, resourceName, resourceType, quantity, unit, organisationName, syncStatus }]
resourceTotalsByDistrict [{ districtCode, quantity }]    // the bar chart
```

## Architecture (API)

```
PostDisasterReportController   getAvailableEvents()  requestReport()
        |
        v
DisasterAnalysisService        listCompletedEvents()  generateDisasterReport(eventId, scope)
        |
        |--> AnalysisDataRepository (port, from the class diagram)
        |      findCompletedEvents  findWarningsByEvent  countCitizensReached
        |      findShelterOccupancyByEvent  findResourceDistributions
        |      implemented by PrismaAnalysisDataRepository (seeded data) and InMemoryAnalysisDataRepository (tests)
        |
        '--> pure functions (analysis/aggregators/*)
               assertConsistent  summariseWarnings  buildOccupancySeries
               peakOccupancy  summariseResources  assessCompleteness
```

`getAvailableEvents` serves `GET /disaster-events` and `/:id`; `requestReport` serves `GET /disaster-events/:id/report`. One controller and one service replace the earlier split into events and analysis modules.

Single responsibility: services gather and orchestrate; the aggregators hold every calculation and are tested without a database; entities hold state only; the data source is behind ports so real data can replace the fake without touching the logic.

## Work Breakdown

Atomic commits (conventional, scoped `api`, `web`, `types`, `docs`), no co-author lines, **do not push**. Each task ends with tests for what it added. Mark `[x]` as steps finish.

```
B0 -> B1 types -> B2 fake dataset builder -> B3 schema+repos -> B4 aggregators -> B5 report service+endpoint -> B6 events API -> B7 seed + API gate
                                                                                                       |                    |
                                                                                      B8 web events list (after B6)   B9 web scope+report (after B5) -> B10 charts+tabs -> B11 verification -> B12 report/docs
```

Critical path: B1-B5, B9, B10. B2 (the dataset) comes early so every later test can run on real-looking data.

### B0 Prerequisites
- [x] **B0.1** Branch `feat/post-disaster-analysis-reports` from `main`. Local only.

### B1 Shared Contract (`packages/types`)
- [x] **B1.1** `districts.ts`: `DISTRICTS` (25, code and name) and `districtName(code)` (see the merge note).
- [x] **B1.2** `analysis.ts`: statuses, levels, labels (with display text), sync statuses, resource types and labels, `DisasterEventDto`, `ListEventsQuery`, `AnalysisScope`, `DataIssueKind`, `PostDisasterReportDto` and its parts.
- [x] **B1.3** Type tests in `contract.test-d.ts`; build. Commit `feat(types): add the post-disaster analysis contract`.

### B2 Fake Dataset
- [x] **B2.1** A small seeded random generator (`mulberry32`), tested: same seed same numbers, different seeds differ, values within range.
- [x] **B2.2** `buildFakeDataset()` (`apps/api/src/analysis/fake-data/`): the seven events above with their alerts, shelters, step-wise occupancy readings (every few hours, rising and falling), and resources; including the pending records, the missing sections, the inconsistent records, and the active event.
- [x] **B2.3** Tests of the builder: deterministic; seven events, six completed and one active; every event has the shape its row in the table promises (for example event 1 has all four alert labels, no pending records; event 6 has a negative occupancy and an orphan reading); all districts valid; reached never exceeds targeted. Commit `feat(api): add the fake dataset for post-disaster analysis`.

### B3 Schema and Repositories (`apps/api`)
- [x] **B3.1** Prisma models above; `prisma validate` and `generate`. (`db push` is a separate step you run, once the database is reachable.)
- [x] **B3.2** `AnalysisDataRepository` interface (the five methods from the class diagram, plus `findEventById`) and `PrismaAnalysisDataRepository`: `findCompletedEvents` with status, hazard type, district, name search, paging. Unit tests with mocked Prisma.
- [x] **B3.3** The other four methods: warnings by event, `countCitizensReached`, shelters with occupancy records, resource distributions (joined to resource and organisation names). Unit tests.
- [x] **B3.4** `InMemoryAnalysisDataRepository`, loaded from `buildFakeDataset()`, for tests. One integration test on `dws_test` (skips without it). Commit.

### B4 Aggregators (pure, the core of the unit tests)
- [x] **B4.1** `assertConsistent(inputs)` per P6: negative or non-whole occupancy, negative or zero quantity, reading for an unknown shelter, reached above targeted. Throws `InconsistentRecordsError` with a message naming the problem.
- [x] **B4.2** `summariseAlerts(alerts, scope)`: alerts in scope (for a district scope, only alerts that cover it, with only that district's numbers), targeted, reached, reach rate (zero targeted gives a rate of zero, not NaN).
- [x] **B4.3** `buildOccupancySeries(readings)`: per shelter and the total step series (the sum of each shelter's latest reading at every change). Cases: one shelter, two interleaved, out-of-order input, equal timestamps, a decrease.
- [x] **B4.4** `peakOccupancy(series, shelters)` and shelter summaries (peak, latest, capacity, status).
- [x] **B4.5** `summariseResources(records)`: totals by district, distinct districts receiving, the same type summed within a district only when the unit matches.
- [x] **B4.6** `assessCompleteness(inputs)` per P3: complete; pending shelter records; pending resource records; no alerts; no shelter data; no resource data; combinations. Each issue has a message and a count. Commit per aggregator, or one `feat(api): add the post-disaster aggregators`.

### B5 Report Service and Endpoint
- [x] **B5.1** `DisasterAnalysisService.generateDisasterReport(eventId, scope)`: load the event (404; 409 if not COMPLETED), validate the district (400), gather data filtered to the scope, `assertConsistent`, run the aggregators, assemble the DTO. Any error becomes one `ReportGenerationError` (503, "Report generation failed. Please try again.") and is logged.
- [x] **B5.2** `PostDisasterReportController.requestReport`, `GET /disaster-events/:id/report`. Tests run the service over the **fake dataset in memory for every event**: event 1 complete for all districts and each single district; events 2-4 incomplete with the right reasons and counts; event 5 empty but valid; event 6 fails with 503 and no body; the active event gives 409; unknown 404; bad district 400.
- [x] **B5.3** Commit `feat(api): generate the post-disaster report`.

### B6 Events API
- [x] **B6.1** DTOs, `DisasterAnalysisService.listCompletedEvents` and `getEvent`, and `PostDisasterReportController.getAvailableEvents` plus `GET /disaster-events/:id`, behind `OfficerGuard`. Tests: each filter, search, paging, unknown id, the active event is excluded from `status=COMPLETED`.
- [x] **B6.2** Wire the analysis module into `AppModule`. Commit.

### B7 Seed Script and API Gate
- [x] **B7.1** `seed:analysis` script: refuses databases without `dev` or `test` in the name, removes earlier demo data, inserts the dataset. The guard and the clean-then-insert plan are pure functions with tests (the database call itself is thin).
- [x] **B7.2** A flow test over the real modules with in-memory repositories (as the existing flow tests): list, filter, scope, generate, all seven events.
- [x] **B7.3** Coverage at least 80% on the new folders (add to `vitest.config.ts`); lint, types, and the production `tsc` clean. Commit.

### B8 Web: Events List (screen 1)
- [x] **B8.1** `api/analysis.ts` + tests; routes `/analysis`, `/analysis/:eventId`, `/analysis/:eventId/report`; nav item **Analysis & Reports**.
- [x] **B8.2** `AnalysisEventsPage`: search, hazard type and district filters (URL search params), table (Event, Hazard Type, Affected Districts, Period, Status chip, Updated, **Analyse**), pagination, loading, error with Retry, and the "Sample data for demonstration" notice. Empty state "No completed disaster events are available for analysis" (the alternate flow).
- [x] **B8.3** Tests and axe. Commit.

### B9 Web: Scope and Report Shell (screens 2 and 3)
- [x] **B9.1** `AnalysisScopePage`: the selected event read-only, radio **All affected districts** or **Specific district** (select limited to the event's districts, required when chosen), **Back**, **Generate Report**, and the "Report includes" list.
- [x] **B9.2** `PostDisasterReportPage` shell: header (event, period, scope), **Data status chip** (Complete, or Incomplete with its reasons), four KPI cards (Alerts Issued, Citizens Reached with its reach rate, Peak Shelter Occupancy and when, Districts Receiving Resources), loading, and the **generation failed** state with Retry (never a partial report).
- [x] **B9.3** Tests: scope validation, district-only, success, incomplete reasons, failure, retry. Axe. Commit.

### B10 Web: Charts and Tabs (screens 3-5)
- [x] **B10.1** `AlertTimeline` (dots on a line, each with its label, time, and level; also a list for screen readers).
- [x] **B10.2** `StepChart` (occupancy over time) and `BarChart` (quantity by district) in SVG with axes, labels, and a table equivalent; the scaling helpers are pure and tested separately.
- [x] **B10.3** Tabs **Overview / Shelter Occupancy / Resource Distribution** (proper `tablist`, arrow keys, state in the URL): shelter table (Shelter, District, Capacity, Peak, Latest, Status chip) and resource table (District, Resource Type, Quantity, Source Organisation), pending rows marked.
- [x] **B10.4** Tests per component, tab keyboard behaviour, empty-section messages ("No shelter data recorded for this scope"), axe. Commits per component.

### B11 Verification
_Not done: the walkthrough in the portal (needs `seed:analysis` on `dws_dev`). The `dws_test` integration test is written and passes. B7.2's separate flow test is the controller spec, which runs every event through the real controller, service and guard in memory._

- [ ] **B11.1** After you run `prisma:push` and `seed:analysis` (needs the database reachable): walk the wireframes in the portal against the seven events (the table above is the script).
- [ ] **B11.2** Record results and screenshots in `docs/superpowers/evidence/`; refresh coverage files.

### B12 Update the Group Report and README
- [x] **B12.1** `2026-10-07-analysis-report-changes.md`: revised scenario (event lifecycle, definitions of reach and incomplete), sequence diagram with alt fragments (P5), class diagram, wireframes as built; and an honest note that the data is generated.
- [x] **B12.2** README: the endpoints, the seed command and its safety rule, and the seven demo events.

## Traceability: Use Case Flow to Work Item

| Flow in the report | Built in | Tested in |
|---|---|---|
| Select the function, list completed events | B6, B8 | B6.1, B8.3 |
| Select an event, show details and district scope | B6.1, B9.1 | B9.3 |
| Choose all districts or one, request the report | B5.1, B9.1 | B5.2, B9.3 |
| Retrieve alerts, reach, occupancy, resources | B3, B5.1 | B5.2, B7.2 |
| Check the available data | B4.6 | B4.6 |
| Compile timeline and citizens reached | B4.2 | B4.2 |
| Compile occupancy over time and resources by district | B4.3-B4.5 | B4.3-B4.5 |
| Generate and display the report | B5, B9.2, B10 | B5.2, B9.3, B10.4 |
| Alt: no disaster events available | B8.2 | B8.3 |
| Alt: specific district selected | B5.1, B9.1 | B5.2, B9.3 |
| Exc: pending synchronisation, marked incomplete | B4.6, B9.2 (event 2) | B4.6, B5.2, B9.3 |
| Exc: report generation error, no invalid report, retry | B4.1, B5.1, B9.2 (event 6) | B4.1, B5.2, B9.3 |
| Postcondition: unavailable or pending data clearly identified | B4.6, B9.2, B10.3 (events 2-5) | B9.3, B10.4 |

## Risks

- **The data is fake, so the numbers prove the logic, not real operations.** Mitigation: the "Sample data" notice, the report says so, and the aggregators are tested with hand-checked small inputs as well as the generated data.
- **Generated data that is too clean hides bugs.** Mitigation: the seven events are chosen to hit the edges (pending, missing sections, empty, inconsistent, one-district narrowing), and a test asserts each event really has its promised shape.
- **Hand-built charts can be wrong at the edges** (empty, a single point, equal values). Mitigation: pure scaling helpers with table tests, and every chart has a table beside it.
- **Merging with the other member's warning work.** Mitigation: the warning data sits behind two methods of `AnalysisDataRepository`; the district list is a small file to swap (see the merge note). The diagram's `HazardWarning` has a single `affectedDistrict`, so a real adapter may need to group warnings per district.
- **Database access is currently blocked on your network** (Atlas DNS, seen earlier). The seed and the integration tests need a reachable database; everything else (unit tests, the in-memory flow test, the web tests) does not.

## Open Questions (defaults chosen so work can start)

- **Q1. Hazard type "Cyclone".** Settled: neither `main` nor the class diagram has Cyclone, so the event uses **Strong Winds**, named "Cyclone" in the event.
- **Q2. Where the fake data lives.** Default: in the database via the seed script (shows the real repository layer). Alternative: in memory only, loaded at start-up, which works without Atlas at all but skips the persistence layer in the demo.
- **Q3. Should the "Sample data" notice be removable?** Default: always shown when `isDemoData` is true.
- **Q4. Donor Organisation.** Default: same officer-key stand-in, full read access (login is out of scope).
- **Q5. Charts.** Default: inline SVG plus tables, no dependency.
