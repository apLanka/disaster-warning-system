import type {
  GeoLocation,
  HazardPhoto,
  HazardType,
  Paginated,
  RejectionReason,
  ReportSort,
  ReportStats,
} from '@repo/types';

import type {
  DecisionStatus,
  HazardReportEntity,
  StoredReportStatus,
} from './domain/hazard-report.entity.js';

export const HAZARD_REPORT_REPOSITORY = Symbol('HAZARD_REPORT_REPOSITORY');

export interface NewHazardReport {
  reporterId: string;
  clientRequestId: string;
  reporterName?: string;
  reporterContact?: string;
  type: HazardType;
  description: string;
  location: GeoLocation;
  photos: HazardPhoto[];
}

export interface ReportDecisionInput {
  status: DecisionStatus;
  decidedBy: string;
  officerNotes?: string;
  rejectionReason?: RejectionReason;
  rejectionDetails?: string;
}

export interface ReportListQuery {
  status?: StoredReportStatus;
  type?: HazardType;
  sort: ReportSort;
  page: number;
  limit: number;
}

export interface CreateResult {
  report: HazardReportEntity;
  /** False when the same clientRequestId was already stored (a replayed submit). */
  created: boolean;
}

export type DecideResult =
  | { outcome: 'DECIDED'; report: HazardReportEntity }
  | { outcome: 'ALREADY_DECIDED' }
  | { outcome: 'NOT_FOUND' };

/** Everything the service needs from storage, with no database types leaking out. */
export interface HazardReportRepository {
  create(input: NewHazardReport): Promise<CreateResult>;
  findById(id: string): Promise<HazardReportEntity | null>;
  findByClientRequestId(
    clientRequestId: string,
  ): Promise<HazardReportEntity | null>;
  findByReporter(
    reporterId: string,
    limit?: number,
  ): Promise<HazardReportEntity[]>;
  list(query: ReportListQuery): Promise<Paginated<HazardReportEntity>>;
  /** `verifiedSince` marks the start of "today" for the verified-today count. */
  stats(verifiedSince: Date): Promise<ReportStats>;
  /** Moves a report out of PENDING_VERIFICATION exactly once. */
  decide(id: string, decision: ReportDecisionInput): Promise<DecideResult>;
}
