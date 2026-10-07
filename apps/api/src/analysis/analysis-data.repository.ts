import type { DistrictCode, HazardType, ResourceType } from '@repo/types';

import type {
  DistributionEntity,
  EventEntity,
  OccupancyRecordEntity,
  ShelterEntity,
  WarningEntity,
} from './domain/analysis.entities.js';

export const ANALYSIS_DATA_REPOSITORY = Symbol('ANALYSIS_DATA_REPOSITORY');

export interface EventListQuery {
  search?: string;
  hazardType?: HazardType;
  district?: DistrictCode;
  page: number;
  limit: number;
}

export interface EventPage {
  items: EventEntity[];
  total: number;
}

/** A distribution with the names of its resource and organisation already joined in. */
export interface ResourceDistributionRecord extends DistributionEntity {
  resourceName: string;
  resourceType: ResourceType;
  organisationName: string;
}

/**
 * Everything the post-disaster analysis reads, behind one port (named after the
 * AnalysisDataRepository in the group class diagram). Read-only: nothing here
 * writes. Seeded data and, later, real warning data are two implementations.
 */
export interface AnalysisDataRepository {
  /** Completed events only, newest first. */
  findCompletedEvents(query: EventListQuery): Promise<EventPage>;
  /** Any event, so the caller can tell "unknown" from "not completed". */
  findEventById(id: string): Promise<EventEntity | null>;
  findWarningsByEvent(eventId: string): Promise<WarningEntity[]>;
  /**
   * Citizens reached by the event's warnings, summed over the given districts
   * (all districts when omitted).
   */
  countCitizensReached(
    eventId: string,
    districts?: readonly DistrictCode[],
  ): Promise<number>;
  findSheltersByEvent(eventId: string): Promise<ShelterEntity[]>;
  findShelterOccupancyByEvent(
    eventId: string,
  ): Promise<OccupancyRecordEntity[]>;
  findResourceDistributions(
    eventId: string,
  ): Promise<ResourceDistributionRecord[]>;
}
