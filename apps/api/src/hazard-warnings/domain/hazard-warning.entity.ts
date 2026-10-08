import type {
  ChannelKind,
  ChannelState,
  District,
  HazardType,
  MessageKind,
  WarningLevel,
  WarningStatus,
} from '@repo/types';

export interface DisseminationChannelState {
  channel: ChannelKind;
  state: ChannelState;
  recipients: number;
  delivered: number;
  attempts: number;
  lastError?: string;
  sentAt?: Date;
}

/** What the officer controls. Everything else is set by the lifecycle. */
export interface WarningContent {
  hazardType: HazardType;
  level: WarningLevel;
  description?: string;
  additionalInfo?: string;
  safetyInstructions: string[];
  districts: District[];
  validFrom?: Date;
  validUntil?: Date;
  sourceReportId?: string;
}

export interface WarningCancellationRecord {
  cancelledAt: Date;
  cancelledBy: string;
  reason: string;
}

/** Plain state with no behaviour: rules live in warning-rules and the services. */
export interface HazardWarningEntity extends WarningContent {
  id: string;
  reference: string;
  clientRequestId: string;
  status: WarningStatus;
  channels: DisseminationChannelState[];
  createdBy: string;
  issuedBy?: string;
  issuedAt?: Date;
  cancellation?: WarningCancellationRecord;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationLogEntity {
  id: string;
  warningId: string;
  channel: ChannelKind;
  kind: MessageKind;
  outcome: 'SENT' | 'FAILED';
  message: string;
  recipients: number;
  createdAt: Date;
}
