import type { DistrictCode } from '@repo/types';

import type {
  AnalysisDataRepository,
  EventListQuery,
  EventPage,
  ResourceDistributionRecord,
} from '../analysis-data.repository.js';
import type {
  EventEntity,
  FakeDataset,
  OccupancyRecordEntity,
  ShelterEntity,
  WarningEntity,
} from '../domain/analysis.entities.js';
import { buildFakeDataset } from '../fake-data/build-fake-dataset.js';
import { sumReached } from '../reach.js';

/** Serves a dataset from memory: the repository used by tests and flow tests. */
export class InMemoryAnalysisDataRepository implements AnalysisDataRepository {
  constructor(private readonly data: FakeDataset = buildFakeDataset()) {}

  findCompletedEvents(query: EventListQuery): Promise<EventPage> {
    const search = query.search?.trim().toLowerCase();
    const matches = this.data.events
      .filter((e) => e.status === 'COMPLETED')
      .filter((e) => !query.hazardType || e.hazardType === query.hazardType)
      .filter(
        (e) => !query.district || e.districtCodes.includes(query.district),
      )
      .filter(
        (e) =>
          !search ||
          e.name.toLowerCase().includes(search) ||
          e.eventId.toLowerCase().includes(search),
      )
      .sort(
        (a, b) => (b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0),
      );
    const start = (query.page - 1) * query.limit;
    return Promise.resolve({
      items: matches.slice(start, start + query.limit),
      total: matches.length,
    });
  }

  findEventById(id: string): Promise<EventEntity | null> {
    return Promise.resolve(this.data.events.find((e) => e.id === id) ?? null);
  }

  findWarningsByEvent(eventId: string): Promise<WarningEntity[]> {
    return Promise.resolve(
      this.data.warnings
        .filter((w) => w.eventId === eventId)
        .sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime()),
    );
  }

  async countCitizensReached(
    eventId: string,
    districts?: readonly DistrictCode[],
  ): Promise<number> {
    return sumReached(await this.findWarningsByEvent(eventId), districts);
  }

  findSheltersByEvent(eventId: string): Promise<ShelterEntity[]> {
    return Promise.resolve(
      this.data.shelters.filter((s) => s.eventId === eventId),
    );
  }

  findShelterOccupancyByEvent(
    eventId: string,
  ): Promise<OccupancyRecordEntity[]> {
    return Promise.resolve(
      this.data.occupancyRecords.filter((r) => r.eventId === eventId),
    );
  }

  findResourceDistributions(
    eventId: string,
  ): Promise<ResourceDistributionRecord[]> {
    const resources = new Map(this.data.resources.map((r) => [r.id, r]));
    const organisations = new Map(
      this.data.organisations.map((o) => [o.id, o]),
    );
    return Promise.resolve(
      this.data.distributions
        .filter((d) => d.eventId === eventId)
        .map((d) => ({
          ...d,
          resourceName:
            resources.get(d.resourceId)?.resourceName ?? 'Unknown resource',
          resourceType: resources.get(d.resourceId)?.resourceType ?? 'OTHER',
          organisationName:
            organisations.get(d.organisationId)?.organisationName ??
            'Unknown organisation',
        })),
    );
  }
}
