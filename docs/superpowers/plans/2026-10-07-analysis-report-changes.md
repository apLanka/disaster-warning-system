# Post-Disaster Analysis and Reports: Changes for the Group Report

Use case owner: IT23697546. What was built, where it differs from the design in `docs/Group_052.pdf` and `docs/class-diagram.txt`, and what has not been verified. Plan: [post-disaster-analysis-reports](2026-10-07-post-disaster-analysis-reports.md).

## The data is generated

There is no real disaster data in the system, so the use case runs on a deterministic sample dataset (seven events, a fixed seed). Everything that handles the data is real: repositories, the consistency check, the aggregators, the API, the screens and the tests. Sample events are marked `isDemoData` and the portal says so on the events list, the scope page and the report. Do not present the figures as real operations.

## Changes to the scenario and diagrams

| # | Gap in the original design | What was built |
|---|---|---|
| P1 | "Events available for analysis" but no event concept. | `DisasterEvent` with status ACTIVE or COMPLETED; only completed events are listed. |
| P2 | "Citizens reached" undefined. | Reached = sum of delivered over the warnings in scope; the report also shows the reach rate against those targeted. Note it counts per alert, so a citizen warned four times is counted four times. |
| P3 | No rule for "incomplete". | Incomplete when a section has no data, or any shelter or resource record is pending synchronisation. Every reason is listed with a count. |
| P4 | Timeline labels with no rule. | Each warning carries its own label (Initial Alert, Escalation, District Update, Final Notice). |
| P5 | Sequence diagram has no alternate or exception fragments. | Add alt fragments: no completed events, specific district, pending synchronisation, generation error. |
| P6 | "Never show an invalid report" not designed. | The service checks records for consistency (negative or fractional occupancy, a reading for an unknown shelter, a zero or negative quantity, reached above targeted) before calculating. Any problem or error is one failure, 503 "Report generation failed. Please try again.", and the page shows Retry and no partial report. |
| P7 | KPI cards undefined. | Alerts issued = warnings in scope. Peak = highest total occupancy at one moment, with when and combined capacity. Districts receiving resources = distinct districts with a record. |
| P8 | Charts with no text equivalent. | Every chart has a written description and a table of the same numbers; the timeline is a list. |

## Differences from the class diagram

- **No per-citizen `AlertDelivery`.** The sample data stores reached and targeted per warning and district. `AnalysisDataRepository.countCitizensReached` is the single place a real delivery count would plug in.
- **`calculateRiskLevel` and `analyzeCitizenFeedback` not built.** No step of the scenario or wireframes uses them. They should be removed from `DisasterAnalysisService` in the diagram, or given a scenario.
- **`District` is a constant list**, not a table; shelters and distributions refer to it by code.
- **No status filter on the events list.** The diagram's `findCompletedEvents` only ever returns completed events, so the API has no `status` parameter (the plan had one).
- **Quantity by district adds different units** (litres, packs, kits). It is a count of items distributed, as the wireframe's bar chart implies; it is not a measure of volume.
- `Reporter` and `HazardWarning` belong to other use cases. The warning data is expected from another member's implementation and is not read yet.

## Class diagram as built

`PostDisasterReportController` (`getAvailableEvents`, `requestReport`) calls `DisasterAnalysisService` (`listCompletedEvents`, `getEvent`, `generateDisasterReport`), which reads through `AnalysisDataRepository` (Prisma, and in-memory for tests) and calls pure functions: `assertConsistent`, `summariseWarnings`, `buildOccupancySeries`, `peakOccupancy`, `summariseShelters`, `summariseResources`, `assessCompleteness`.

## Results

| Check | Result |
|---|---|
| API unit tests (`bun run test`, unit project) | 398 pass; the analysis folder is at 96% line coverage (threshold 80%) |
| Web tests | 320 pass; 99% lines overall |
| Accessibility (axe) | The events list (also empty), the scope page (also with its error), the report in all three sections, an empty report and a failed report have no violations. Colour contrast is not checked by axe in jsdom. |
| Report for each of the seven events | Run in `post-disaster-report.controller.spec.ts` over the real controller, service and guard with the dataset in memory. |

## Not verified

- **Nothing has run against a real database.** `prisma:push` and `seed:analysis` have not been run (Atlas has not been reachable from the development network), and there is no database integration test for `PrismaAnalysisDataRepository`; it is covered with a mocked Prisma client only.
- **The screens have not been checked by eye in a browser**, and not against the hi-fi wireframes side by side. The Resource Distribution wireframe was not in the pages read; it is assumed to match the low-fi one.
- The charts are hand-drawn SVG; edge cases (no data, one reading, all zeros) are tested, but their look is unchecked.
