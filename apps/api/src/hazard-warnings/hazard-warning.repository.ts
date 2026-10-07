import type {
  District,
  HazardType,
  Paginated,
  WarningStats,
  WarningStatus,
  WarningView,
} from '@repo/types';

import type {
  DisseminationChannelState,
  HazardWarningEntity,
  WarningContent,
} from './domain/hazard-warning.entity.js';

export const HAZARD_WARNING_REPOSITORY = Symbol('HAZARD_WARNING_REPOSITORY');

export interface NewWarning extends WarningContent {
  clientRequestId: string;
  createdBy: string;
  status: 'DRAFT' | 'DISSEMINATING';
  channels: DisseminationChannelState[];
  issuedBy?: string;
  issuedAt?: Date;
}

export interface CreateWarningResult {
  warning: HazardWarningEntity;
  /** False when the same clientRequestId was already stored (a replayed request). */
  created: boolean;
}

export interface DisseminationStart {
  issuedBy?: string;
  issuedAt?: Date;
  validFrom?: Date;
  channels?: DisseminationChannelState[];
}

export interface CancelInput {
  cancelledBy: string;
  reason: string;
  cancelledAt: Date;
}

export type TransitionResult =
  | { outcome: 'UPDATED'; warning: HazardWarningEntity }
  | { outcome: 'WRONG_STATE'; warning: HazardWarningEntity }
  | { outcome: 'NOT_FOUND' };

export interface OverlapQuery {
  hazardType: HazardType;
  districts: District[];
  now: Date;
  excludeId?: string;
}

export interface WarningListQuery {
  view: WarningView;
  page: number;
  limit: number;
  now: Date;
}

/** Everything the services need from storage, with no database types leaking out. */
export interface HazardWarningRepository {
  create(input: NewWarning): Promise<CreateWarningResult>;
  findById(id: string): Promise<HazardWarningEntity | null>;
  findByIds(ids: string[]): Promise<HazardWarningEntity[]>;
  findByClientRequestId(
    clientRequestId: string,
  ): Promise<HazardWarningEntity | null>;
  /** Edits a warning only while it is a DRAFT. */
  updateDraft(id: string, content: WarningContent): Promise<TransitionResult>;
  deleteDraft(id: string): Promise<'DELETED' | 'NOT_DRAFT' | 'NOT_FOUND'>;
  /** Moves to DISSEMINATING only from one of `from`, so two officers cannot both start it. */
  startDissemination(
    id: string,
    from: readonly WarningStatus[],
    changes: DisseminationStart,
  ): Promise<TransitionResult>;
  recordDissemination(
    id: string,
    channels: DisseminationChannelState[],
    status: WarningStatus,
  ): Promise<HazardWarningEntity>;
  /** Cancels only an issued, not yet cancelled warning. */
  cancel(id: string, input: CancelInput): Promise<TransitionResult>;
  findActiveOverlapping(query: OverlapQuery): Promise<HazardWarningEntity[]>;
  list(query: WarningListQuery): Promise<Paginated<HazardWarningEntity>>;
  stats(now: Date, todayStart: Date): Promise<WarningStats>;
}
