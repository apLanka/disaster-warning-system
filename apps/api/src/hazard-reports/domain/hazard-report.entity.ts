import type {
  GeoLocation,
  HazardPhoto,
  HazardReportDto,
  HazardType,
  RejectionReason,
} from '@repo/types';

/** Statuses the server stores. PENDING_SYNC only ever exists on the device. */
export type StoredReportStatus = HazardReportDto['status'];

export type DecisionStatus = Extract<
  StoredReportStatus,
  'VERIFIED' | 'REJECTED'
>;

export interface HazardReportDecision {
  decidedAt: Date;
  decidedBy: string;
  officerNotes?: string;
  rejectionReason?: RejectionReason;
  rejectionDetails?: string;
}

/** Plain state with no behaviour: rules live in the service, storage in the repository. */
export interface HazardReportEntity {
  id: string;
  reference: string;
  reporterId: string;
  clientRequestId: string;
  reporterName?: string;
  reporterContact?: string;
  type: HazardType;
  description: string;
  location: GeoLocation;
  photos: HazardPhoto[];
  status: StoredReportStatus;
  decision?: HazardReportDecision;
  createdAt: Date;
  updatedAt: Date;
}
