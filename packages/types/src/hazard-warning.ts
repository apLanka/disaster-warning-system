import type { District } from './districts.js';
import type { HazardType } from './hazard-report.js';

export const WARNING_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type WarningLevel = (typeof WARNING_LEVELS)[number];

export const WARNING_LEVEL_LABELS: Record<WarningLevel, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const WARNING_STATUSES = [
  'DRAFT',
  'DISSEMINATING',
  'DISSEMINATED',
  'PARTIALLY_DISSEMINATED',
  'PENDING_DISSEMINATION',
  'CANCELLED',
] as const;
export type WarningStatus = (typeof WARNING_STATUSES)[number];

export const WARNING_STATUS_LABELS: Record<WarningStatus, string> = {
  DRAFT: 'Draft',
  DISSEMINATING: 'Disseminating',
  DISSEMINATED: 'Disseminated',
  PARTIALLY_DISSEMINATED: 'Partially Disseminated',
  PENDING_DISSEMINATION: 'Pending Dissemination',
  CANCELLED: 'Cancelled',
};

/** Statuses of a warning that has been issued and not cancelled. */
export const ISSUED_STATUSES = [
  'DISSEMINATING',
  'DISSEMINATED',
  'PARTIALLY_DISSEMINATED',
  'PENDING_DISSEMINATION',
] as const satisfies readonly WarningStatus[];

export const CHANNEL_KINDS = ['PUSH', 'SMS', 'AUDIBLE'] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];

export const CHANNEL_LABELS: Record<ChannelKind, string> = {
  PUSH: 'Push Notification',
  SMS: 'SMS',
  AUDIBLE: 'Audible Alert',
};

/** SKIPPED: the channel had nobody to reach (e.g. no citizen gave a phone number). */
export type ChannelState = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

export type MessageKind = 'WARNING' | 'ALL_CLEAR';

export const WARNING_LIMITS = {
  descriptionMin: 10,
  descriptionMax: 1000,
  additionalInfoMax: 500,
  instructionsMax: 8,
  instructionMin: 3,
  instructionMax: 200,
  districtsMax: 25,
  cancelReasonMin: 5,
  cancelReasonMax: 300,
  pageSizeMax: 50,
} as const;

export type WarningView = 'active' | 'drafts' | 'past';

/** What the officer fills in. A draft needs only type, level and districts. */
export interface WarningFields {
  hazardType: HazardType;
  level: WarningLevel;
  districts: District[];
  description?: string;
  additionalInfo?: string;
  safetyInstructions?: string[];
  /** ISO 8601. Defaults to the issue time. */
  validFrom?: string;
  /** ISO 8601. Required to issue. */
  validUntil?: string;
  /** Set when the warning was started from a verified hazard report. */
  sourceReportId?: string;
}

export interface CreateWarningInput extends WarningFields {
  clientRequestId: string;
  action: 'DRAFT' | 'ISSUE';
  /** Issue even though an active warning already covers the same hazard and district. */
  force?: boolean;
}

export interface IssueWarningInput {
  force?: boolean;
}

export interface CancelWarningInput {
  reason: string;
}

export interface ListWarningsQuery {
  view?: WarningView;
  page?: number;
  limit?: number;
}

export interface DisseminationStatusDto {
  channel: ChannelKind;
  state: ChannelState;
  recipients: number;
  delivered: number;
  attempts: number;
  lastError?: string;
  sentAt?: string;
}

export interface WarningCancellation {
  cancelledAt: string;
  cancelledBy: string;
  reason: string;
}

export interface HazardWarningDto {
  id: string;
  /** Human-readable id, e.g. "HW-2026-0007". */
  reference: string;
  hazardType: HazardType;
  level: WarningLevel;
  description?: string;
  additionalInfo?: string;
  safetyInstructions: string[];
  districts: District[];
  validFrom?: string;
  validUntil?: string;
  sourceReportId?: string;
  status: WarningStatus;
  /** Issued, not cancelled, and not yet past validUntil. */
  active: boolean;
  channels: DisseminationStatusDto[];
  createdBy: string;
  issuedBy?: string;
  issuedAt?: string;
  cancellation?: WarningCancellation;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLogDto {
  id: string;
  channel: ChannelKind;
  kind: MessageKind;
  outcome: 'SENT' | 'FAILED';
  message: string;
  recipients: number;
  createdAt: string;
}

export interface HazardWarningDetailDto extends HazardWarningDto {
  /** Newest first, at most 50. */
  logs: NotificationLogDto[];
  /** Citizens who tapped Acknowledge. */
  acknowledged: number;
}

export interface WarningPreview {
  recipients: {
    total: number;
    withPhone: number;
    byDistrict: Partial<Record<District, number>>;
  };
  /** Active warnings for the same hazard type in any of the same districts. */
  duplicates: HazardWarningDto[];
}

export interface WarningStats {
  active: number;
  drafts: number;
  issuedToday: number;
}

export interface WarningPrefill {
  hazardType: HazardType;
  districts: District[];
  description: string;
  sourceReportId: string;
  reportReference: string;
}

export interface RegisterCitizenInput {
  district: District;
  /** Sri Lankan mobile, for SMS warnings. */
  phone?: string;
}

export interface CitizenProfileDto {
  district: District;
  phone?: string;
  updatedAt: string;
}

export type CitizenAlertState = 'ACTIVE' | 'ALL_CLEAR' | 'EXPIRED';

/** A warning as one citizen sees it. Officer names and internal fields are left out. */
export interface CitizenAlertDto {
  /** The warning id. */
  id: string;
  reference: string;
  hazardType: HazardType;
  level: WarningLevel;
  districts: District[];
  description: string;
  safetyInstructions: string[];
  issuedAt: string;
  validUntil: string;
  state: CitizenAlertState;
  /** Why the officer cancelled it; present when state is ALL_CLEAR. */
  cancelReason?: string;
  acknowledgedAt: string | null;
}
