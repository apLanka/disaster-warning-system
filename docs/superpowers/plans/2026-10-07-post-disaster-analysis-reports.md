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

**Integration path (for the report, not built).** The alert data comes through a small `AlertSource` port. The seeded `event_alerts` collection is one implementation; when the warning use case is merged, an adapter over real warnings is a second one, and nothing else changes.

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

**Merge note.** The warning branch also adds a district list (`packages/types/src/areas.ts`, with `DISTRICTS` and `District`). To avoid a clash, this branch puts its list in `districts.ts` with the same shape (code, name, plus centre latitude and longitude); whichever branch merges second deletes one of the two files and re-exports the other. This is a five-minute fix, flagged now so it is not a surprise.

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
- **Alerts.** `EventAlert`: `eventId`, `issuedAt`, `level` (CRITICAL, HIGH, MEDIUM, LOW), `label` (INITIAL_ALERT, ESCALATION, DISTRICT_UPDATE, FINAL_NOTICE), `title`, and `districts: [{ districtCode, targeted, reached }]`.
- **Shelters.** `Shelter` (`name`, `districtCode`, `capacity`, `status` OPEN or CLOSED, `eventId`) and `ShelterOccupancy` readings (`shelterId`, `eventId`, `occupancy`, `recordedAt`, `syncStatus` SYNCED or PENDING). Occupancy over time is a **step function**: a reading holds until the next one, which is what the wireframe draws.
- **Resources.** `ResourceDistribution` (`eventId`, `districtCode`, `resourceType` WATER, FOOD, MEDICINE, SHELTER_SUPPLIES, OTHER, `quantity`, `unit`, `sourceOrganisation`, `distributedAt`, `syncStatus`).
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

model EventAlert {
  id String @id @default(auto()) @map("_id") @db.ObjectId
  eventId String @db.ObjectId
  issuedAt DateTime
  level AlertLevel
  label AlertLabel
  title String
  districts DistrictReach[]
  @@index([eventId, issuedAt])
  @@map("event_alerts")
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

model ShelterOccupancy {
  id String @id @default(auto()) @map("_id") @db.ObjectId
  shelterId String @db.ObjectId
  eventId String @db.ObjectId
  occupancy Int
  recordedAt DateTime
  syncStatus SyncStatus
  @@index([eventId, recordedAt])
  @@map("shelter_occupancy")
}

model ResourceDistribution {
  id String @id @default(auto()) @map("_id") @db.ObjectId
  eventId String @db.ObjectId
  districtCode String
  resourceType ResourceType
  quantity Int
  unit String
  sourceOrganisation String
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
event { id, eventId, name, hazardType, districtCodes, startedAt, endedAt, isDemoData }
scope { kind: ALL | DISTRICT, districtCode? }
generatedAt
dataStatus { complete: boolean, issues: [{ kind, message, count? }] }
summary { alertsIssued, citizensTargeted, citizensReached, reachRate,
          peakShelterOccupancy { value, at, capacity } | null, districtsReceivingResources }
alertTimeline [{ id, at, level, label, title, targeted, reached }]
shelters [{ shelterId, name, districtCode, capacity, peakOccupancy, latestOccupancy, status }]
occupancyTotalSeries [{ at, occupancy }]                 // the step chart
resources [{ districtCode, resourceType, quantity, unit, sourceOrganisation, syncStatus }]
resourceTotalsByDistrict [{ districtCode, quantity }]    // the bar chart
```

## Architecture (API)

```
DisasterEventsController --> DisasterEventsService --> EventRepository
AnalysisController -------> PostDisasterReportService
                              |-> EventRepository
                              |-> AlertSource (port)  <- SeededAlertSource (event_alerts)
                              |-> ShelterRepository (shelters + occupancy)
                              |-> ResourceRepository
                              '-> pure functions (analysis/aggregators/*)
                                    assertConsistent  summariseAlerts  buildOccupancySeries
                                    peakOccupancy  summariseResources  assessCompleteness
```

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
- [ ] **B1.1** `districts.ts`: `DISTRICTS` (25, code and name) and `districtName(code)` (see the merge note).
- [ ] **B1.2** `analysis.ts`: statuses, levels, labels (with display text), sync statuses, resource types and labels, `DisasterEventDto`, `ListEventsQuery`, `AnalysisScope`, `DataIssueKind`, `PostDisasterReportDto` and its parts.
- [ ] **B1.3** Type tests in `contract.test-d.ts`; build. Commit `feat(types): add the post-disaster analysis contract`.

### B2 Fake Dataset
- [ ] **B2.1** A small seeded random generator (`mulberry32`), tested: same seed same numbers, different seeds differ, values within range.
- [ ] **B2.2** `buildFakeDataset()` (`apps/api/src/analysis/fake-data/`): the seven events above with their alerts, shelters, step-wise occupancy readings (every few hours, rising and falling), and resources; including the pending records, the missing sections, the inconsistent records, and the active event.
- [ ] **B2.3** Tests of the builder: deterministic; seven events, six completed and one active; every event has the shape its row in the table promises (for example event 1 has all four alert labels, no pending records; event 6 has a negative occupancy and an orphan reading); all districts valid; reached never exceeds targeted. Commit `feat(api): add the fake dataset for post-disaster analysis`.

### B3 Schema and Repositories (`apps/api`)
- [ ] **B3.1** Prisma models above; `prisma validate` and `generate`. (`db push` is a separate step you run, once the database is reachable.)
- [ ] **B3.2** `disaster-events/` entity, repository interface, Prisma implementation (list with status, hazard type, district, name search, paging; find by id). Unit tests with mocked Prisma.
- [ ] **B3.3** `analysis/` repositories: alerts by event (`AlertSource`), shelters and occupancy by event, resources by event. Unit tests.
- [ ] **B3.4** In-memory implementations of all of them, loaded from `buildFakeDataset()`, for tests. One integration test on `dws_test` (skips without it). Commit.

### B4 Aggregators (pure, the core of the unit tests)
- [ ] **B4.1** `assertConsistent(inputs)` per P6: negative or non-whole occupancy, negative or zero quantity, reading for an unknown shelter, reached above targeted. Throws `InconsistentRecordsError` with a message naming the problem.
- [ ] **B4.2** `summariseAlerts(alerts, scope)`: alerts in scope (for a district scope, only alerts that cover it, with only that district's numbers), targeted, reached, reach rate (zero targeted gives a rate of zero, not NaN).
- [ ] **B4.3** `buildOccupancySeries(readings)`: per shelter and the total step series (the sum of each shelter's latest reading at every change). Cases: one shelter, two interleaved, out-of-order input, equal timestamps, a decrease.
- [ ] **B4.4** `peakOccupancy(series, shelters)` and shelter summaries (peak, latest, capacity, status).
- [ ] **B4.5** `summariseResources(records)`: totals by district, distinct districts receiving, the same type summed within a district only when the unit matches.
- [ ] **B4.6** `assessCompleteness(inputs)` per P3: complete; pending shelter records; pending resource records; no alerts; no shelter data; no resource data; combinations. Each issue has a message and a count. Commit per aggregator, or one `feat(api): add the post-disaster aggregators`.

### B5 Report Service and Endpoint
- [ ] **B5.1** `PostDisasterReportService.generate(eventId, scope)`: load the event (404; 409 if not COMPLETED), validate the district (400), gather data filtered to the scope, `assertConsistent`, run the aggregators, assemble the DTO. Any error becomes one `ReportGenerationError` (503, "Report generation failed. Please try again.") and is logged.
- [ ] **B5.2** `AnalysisController` `GET /disaster-events/:id/report`. Tests run the service over the **fake dataset in memory for every event**: event 1 complete for all districts and each single district; events 2-4 incomplete with the right reasons and counts; event 5 empty but valid; event 6 fails with 503 and no body; the active event gives 409; unknown 404; bad district 400.
- [ ] **B5.3** Commit `feat(api): generate the post-disaster report`.

### B6 Events API
- [ ] **B6.1** DTOs, `DisasterEventsService` (list with filters, completed only when asked, search by name, get), `DisasterEventsController` behind `OfficerGuard`. Tests: each filter, search, paging, unknown id, the active event is excluded from `status=COMPLETED`.
- [ ] **B6.2** Wire both modules into `AppModule`. Commit.

### B7 Seed Script and API Gate
- [ ] **B7.1** `seed:analysis` script: refuses databases without `dev` or `test` in the name, removes earlier demo data, inserts the dataset. The guard and the clean-then-insert plan are pure functions with tests (the database call itself is thin).
- [ ] **B7.2** A flow test over the real modules with in-memory repositories (as the existing flow tests): list, filter, scope, generate, all seven events.
- [ ] **B7.3** Coverage at least 80% on the new folders (add to `vitest.config.ts`); lint, types, and the production `tsc` clean. Commit.

### B8 Web: Events List (screen 1)
- [ ] **B8.1** `api/analysis.ts` + tests; routes `/analysis`, `/analysis/:eventId`, `/analysis/:eventId/report`; nav item **Analysis & Reports**.
- [ ] **B8.2** `AnalysisEventsPage`: search, hazard type and district filters (URL search params), table (Event, Hazard Type, Affected Districts, Period, Status chip, Updated, **Analyse**), pagination, loading, error with Retry, and the "Sample data for demonstration" notice. Empty state "No completed disaster events are available for analysis" (the alternate flow).
- [ ] **B8.3** Tests and axe. Commit.

### B9 Web: Scope and Report Shell (screens 2 and 3)
- [ ] **B9.1** `AnalysisScopePage`: the selected event read-only, radio **All affected districts** or **Specific district** (select limited to the event's districts, required when chosen), **Back**, **Generate Report**, and the "Report includes" list.
- [ ] **B9.2** `PostDisasterReportPage` shell: header (event, period, scope), **Data status chip** (Complete, or Incomplete with its reasons), four KPI cards (Alerts Issued, Citizens Reached with its reach rate, Peak Shelter Occupancy and when, Districts Receiving Resources), loading, and the **generation failed** state with Retry (never a partial report).
- [ ] **B9.3** Tests: scope validation, district-only, success, incomplete reasons, failure, retry. Axe. Commit.

### B10 Web: Charts and Tabs (screens 3-5)
- [ ] **B10.1** `AlertTimeline` (dots on a line, each with its label, time, and level; also a list for screen readers).
- [ ] **B10.2** `StepChart` (occupancy over time) and `BarChart` (quantity by district) in SVG with axes, labels, and a table equivalent; the scaling helpers are pure and tested separately.
- [ ] **B10.3** Tabs **Overview / Shelter Occupancy / Resource Distribution** (proper `tablist`, arrow keys, state in the URL): shelter table (Shelter, District, Capacity, Peak, Latest, Status chip) and resource table (District, Resource Type, Quantity, Source Organisation), pending rows marked.
- [ ] **B10.4** Tests per component, tab keyboard behaviour, empty-section messages ("No shelter data recorded for this scope"), axe. Commits per component.

### B11 Verification
- [ ] **B11.1** After you run `prisma:push` and `seed:analysis` (needs the database reachable): walk the wireframes in the portal against the seven events (the table above is the script).
- [ ] **B11.2** Record results and screenshots in `docs/superpowers/evidence/`; refresh coverage files.

### B12 Update the Group Report and README
- [ ] **B12.1** `2026-10-07-analysis-report-changes.md`: revised scenario (event lifecycle, definitions of reach and incomplete), sequence diagram with alt fragments (P5), class diagram, wireframes as built; and an honest note that the data is generated.
- [ ] **B12.2** README: the endpoints, the seed command and its safety rule, and the seven demo events.

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
- **Merging with the warning branch.** Mitigation: the district list clash is known and small (see the merge note); the alert data is behind `AlertSource`.
- **Database access is currently blocked on your network** (Atlas DNS, seen earlier). The seed and the integration tests need a reachable database; everything else (unit tests, the in-memory flow test, the web tests) does not.

## Open Questions (defaults chosen so work can start)

- **Q1. Hazard type "Cyclone".** The wireframe lists Flood, Landslide, Cyclone, but `HazardType` on `main` has no Cyclone. Default: use **Strong Winds**, named "Cyclone" in the event. Alternative: add Cyclone to the shared enum (touches the earlier use case).
- **Q2. Where the fake data lives.** Default: in the database via the seed script (shows the real repository layer). Alternative: in memory only, loaded at start-up, which works without Atlas at all but skips the persistence layer in the demo.
- **Q3. Should the "Sample data" notice be removable?** Default: always shown when `isDemoData` is true.
- **Q4. Donor Organisation.** Default: same officer-key stand-in, full read access (login is out of scope).
- **Q5. Charts.** Default: inline SVG plus tables, no dependency.
