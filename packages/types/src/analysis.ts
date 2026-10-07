import type { DistrictCode } from './districts.js';
import type { HazardType } from './hazard-report.js';

export const EVENT_STATUSES = ['ACTIVE', 'COMPLETED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
};

export const ALERT_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const ALERT_LABELS = [
  'INITIAL_ALERT',
  'ESCALATION',
  'DISTRICT_UPDATE',
  'FINAL_NOTICE',
] as const;
export type AlertLabel = (typeof ALERT_LABELS)[number];

export const ALERT_LABEL_TEXT: Record<AlertLabel, string> = {
  INITIAL_ALERT: 'Initial Alert',
  ESCALATION: 'Escalation',
  DISTRICT_UPDATE: 'District Update',
  FINAL_NOTICE: 'Final Notice',
};

export const SYNC_STATUSES = ['SYNCED', 'PENDING'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const SHELTER_STATUSES = ['OPEN', 'CLOSED'] as const;
export type ShelterStatus = (typeof SHELTER_STATUSES)[number];

export const SHELTER_STATUS_LABELS: Record<ShelterStatus, string> = {
  OPEN: 'Open',
  CLOSED: 'Closed',
};

export const RESOURCE_TYPES = [
  'WATER',
  'FOOD',
  'MEDICINE',
  'SHELTER_SUPPLIES',
  'OTHER',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  WATER: 'Water',
  FOOD: 'Food',
  MEDICINE: 'Medicine',
  SHELTER_SUPPLIES: 'Shelter Supplies',
  OTHER: 'Other',
};

export const ANALYSIS_LIMITS = {
  pageSizeDefault: 10,
  pageSizeMax: 50,
} as const;

export interface DisasterEventDto {
  id: string;
  /** Human reference, for example DE-2026-0001. */
  eventId: string;
  name: string;
  hazardType: HazardType;
  districtCodes: DistrictCode[];
  startedAt: string;
  endedAt: string | null;
  status: EventStatus;
  /** True for generated sample data: the portal labels it as such. */
  isDemoData: boolean;
  updatedAt: string;
}

export interface ListEventsQuery {
  status?: EventStatus;
  search?: string;
  hazardType?: HazardType;
  district?: DistrictCode;
  page?: number;
  limit?: number;
}

export interface PagedEvents {
  items: DisasterEventDto[];
  total: number;
  page: number;
  limit: number;
}

export type AnalysisScope =
  { kind: 'ALL' } | { kind: 'DISTRICT'; districtCode: DistrictCode };

export const DATA_ISSUE_KINDS = [
  'PENDING_SHELTER_RECORDS',
  'PENDING_RESOURCE_RECORDS',
  'NO_WARNINGS',
  'NO_SHELTER_DATA',
  'NO_RESOURCE_DATA',
] as const;
export type DataIssueKind = (typeof DATA_ISSUE_KINDS)[number];

export interface DataIssue {
  kind: DataIssueKind;
  message: string;
  /** Number of records affected, when the issue is about pending records. */
  count?: number;
}

export type DataCompletenessStatus = 'COMPLETE' | 'INCOMPLETE';

export interface DataStatus {
  complete: boolean;
  issues: DataIssue[];
}

export interface PeakOccupancy {
  value: number;
  at: string;
  capacity: number;
}

export interface ReportSummary {
  alertsIssued: number;
  citizensTargeted: number;
  citizensReached: number;
  /** 0 to 1; zero when nobody was targeted. */
  reachRate: number;
  peakShelterOccupancy: PeakOccupancy | null;
  districtsReceivingResources: number;
}

export interface AlertTimelineItem {
  id: string;
  at: string;
  level: AlertLevel;
  label: AlertLabel;
  title: string;
  targeted: number;
  reached: number;
}

export interface ShelterSummary {
  shelterId: string;
  name: string;
  districtCode: DistrictCode;
  capacity: number;
  peakOccupancy: number;
  latestOccupancy: number;
  status: ShelterStatus;
  pendingRecords: number;
}

export interface OccupancyPoint {
  at: string;
  occupancy: number;
}

export interface ResourceRow {
  districtCode: DistrictCode;
  resourceName: string;
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  organisationName: string;
  syncStatus: SyncStatus;
}

export interface ResourceDistrictTotal {
  districtCode: DistrictCode;
  quantity: number;
}

export interface PostDisasterReportDto {
  reportId: string;
  generatedAt: string;
  event: DisasterEventDto;
  scope: AnalysisScope;
  /** The district codes this report covers. */
  districtIds: DistrictCode[];
  citizensReached: number;
  dataCompletenessStatus: DataCompletenessStatus;
  dataStatus: DataStatus;
  summary: ReportSummary;
  alertTimeline: AlertTimelineItem[];
  shelters: ShelterSummary[];
  occupancyTotalSeries: OccupancyPoint[];
  resources: ResourceRow[];
  resourceTotalsByDistrict: ResourceDistrictTotal[];
}
