export const HAZARD_TYPES = [
  'FLOOD',
  'RISING_RIVER_LEVEL',
  'LANDSLIDE',
  'ROAD_BLOCKAGE',
  'WILDFIRE',
  'STRONG_WINDS',
  'OTHER',
] as const;
export type HazardType = (typeof HAZARD_TYPES)[number];

export const HAZARD_TYPE_LABELS: Record<HazardType, string> = {
  FLOOD: 'Flood',
  RISING_RIVER_LEVEL: 'Rising River Level',
  LANDSLIDE: 'Landslide',
  ROAD_BLOCKAGE: 'Road Blockage',
  WILDFIRE: 'Wildfire',
  STRONG_WINDS: 'Strong Winds',
  OTHER: 'Other',
};

// PENDING_SYNC exists only on the device (offline queue); the server never stores it.
export const REPORT_STATUSES = [
  'PENDING_SYNC',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING_SYNC: 'Pending Synchronization',
  PENDING_VERIFICATION: 'Pending Verification',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

export const REJECTION_REASONS = [
  'DUPLICATE',
  'INSUFFICIENT_INFORMATION',
  'UNVERIFIABLE',
  'OUT_OF_AREA',
  'OTHER',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  DUPLICATE: 'Duplicate of an existing report',
  INSUFFICIENT_INFORMATION: 'Insufficient information',
  UNVERIFIABLE: 'Could not be verified',
  OUT_OF_AREA: 'Outside the monitored area',
  OTHER: 'Other',
};

export const HAZARD_REPORT_LIMITS = {
  descriptionMin: 10,
  descriptionMax: 1000,
  notesMax: 500,
  photosMax: 5,
  photoMaxBytes: 5 * 1024 * 1024,
  photoMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  pageSizeMax: 50,
} as const;

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface HazardPhoto {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  bytes: number;
}

export interface HazardReportDecision {
  decidedAt: string;
  decidedBy: string;
  officerNotes?: string;
  rejectionReason?: RejectionReason;
  rejectionDetails?: string;
}

export interface HazardReportDto {
  id: string;
  /** Human-readable id shown in the portal, e.g. "HR-2026-0412". */
  reference: string;
  reporterId: string;
  reporterName?: string;
  reporterContact?: string;
  type: HazardType;
  description: string;
  location: GeoLocation;
  photos: HazardPhoto[];
  status: Exclude<ReportStatus, 'PENDING_SYNC'>;
  decision?: HazardReportDecision;
  createdAt: string;
  updatedAt: string;
}

/** Text fields of the multipart submit request; photos travel as files. */
export interface CreateHazardReportFields {
  clientRequestId: string;
  type: HazardType;
  description: string;
  latitude: number;
  longitude: number;
  reporterName?: string;
  reporterContact?: string;
}

export interface VerifyReportInput {
  notes?: string;
}

export interface RejectReportInput {
  reason: RejectionReason;
  /** Required when reason is OTHER. */
  details?: string;
  notes?: string;
}

export type ReportSort = 'newest' | 'oldest';

export interface ListReportsQuery {
  status?: Exclude<ReportStatus, 'PENDING_SYNC'>;
  type?: HazardType;
  sort?: ReportSort;
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ReportStats {
  pending: number;
  verifiedToday: number;
  rejected: number;
  total: number;
}

export type NotificationKind = 'REPORT_VERIFIED' | 'REPORT_REJECTED';

export interface NotificationDto {
  id: string;
  reporterId: string;
  reportId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

/** Error body returned by the API's global exception filter. */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
}
