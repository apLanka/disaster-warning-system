import type {
  AlertLabel,
  AlertLevel,
  DistrictCode,
  EventStatus,
  HazardType,
  ResourceType,
  ShelterStatus,
  SyncStatus,
} from '@repo/types';

/** Plain state with no behaviour: calculations live in the aggregators. */
export interface EventEntity {
  id: string;
  /** Human reference, for example DE-2026-0001. */
  eventId: string;
  name: string;
  hazardType: HazardType;
  districtCodes: DistrictCode[];
  startedAt: Date;
  endedAt: Date | null;
  status: EventStatus;
  isDemoData: boolean;
  updatedAt: Date;
}

export interface DistrictReach {
  districtCode: DistrictCode;
  targeted: number;
  reached: number;
}

export interface WarningEntity {
  id: string;
  eventId: string;
  issuedAt: Date;
  level: AlertLevel;
  label: AlertLabel;
  title: string;
  districts: DistrictReach[];
}

export interface ShelterEntity {
  id: string;
  eventId: string;
  name: string;
  districtCode: DistrictCode;
  capacity: number;
  status: ShelterStatus;
}

export interface OccupancyRecordEntity {
  id: string;
  shelterId: string;
  eventId: string;
  occupancyCount: number;
  recordedAt: Date;
  syncStatus: SyncStatus;
}

export interface ResourceEntity {
  id: string;
  resourceName: string;
  resourceType: ResourceType;
}

export interface OrganisationEntity {
  id: string;
  organisationName: string;
  organisationType: string;
}

export interface DistributionEntity {
  id: string;
  eventId: string;
  districtCode: DistrictCode;
  resourceId: string;
  organisationId: string;
  quantity: number;
  unit: string;
  distributedAt: Date;
  syncStatus: SyncStatus;
}

export interface FakeDataset {
  events: EventEntity[];
  warnings: WarningEntity[];
  shelters: ShelterEntity[];
  occupancyRecords: OccupancyRecordEntity[];
  resources: ResourceEntity[];
  organisations: OrganisationEntity[];
  distributions: DistributionEntity[];
}
