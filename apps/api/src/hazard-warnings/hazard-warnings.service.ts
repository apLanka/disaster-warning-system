import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  CHANNEL_KINDS,
  HAZARD_TYPE_LABELS,
  type ChannelKind,
  type CreateWarningInput,
  type WarningFields,
  type WarningStatus,
} from '@repo/types';

import { CITIZEN_DIRECTORY } from '../citizens/citizen-directory.js';
import type {
  CitizenDirectory,
  RecipientCount,
} from '../citizens/citizen-directory.js';
import { WarningDisseminator } from './dissemination/warning-disseminator.js';
import type {
  HazardWarningEntity,
  WarningContent,
} from './domain/hazard-warning.entity.js';
import {
  contentProblems,
  describeDistricts,
  initialChannels,
  issueProblems,
  mergeChannels,
  overallStatus,
  hasExpired,
  isStuck,
  RETRYABLE_STATUSES,
  retryableChannels,
} from './domain/warning-rules.js';
import { HAZARD_WARNING_REPOSITORY } from './hazard-warning.repository.js';
import type {
  CreateWarningResult,
  HazardWarningRepository,
  TransitionResult,
} from './hazard-warning.repository.js';

export interface WarningPreviewResult {
  recipients: RecipientCount;
  duplicates: HazardWarningEntity[];
}

export function toWarningContent(fields: WarningFields): WarningContent {
  return {
    hazardType: fields.hazardType,
    level: fields.level,
    description: fields.description,
    additionalInfo: fields.additionalInfo,
    safetyInstructions: fields.safetyInstructions ?? [],
    districts: fields.districts,
    validFrom: fields.validFrom ? new Date(fields.validFrom) : undefined,
    validUntil: fields.validUntil ? new Date(fields.validUntil) : undefined,
    sourceReportId: fields.sourceReportId,
  };
}

function reject(problems: string[]): void {
  if (problems.length > 0) throw new BadRequestException(problems.join('; '));
}

/**
 * The warning lifecycle: draft, issue, send, retry, cancel. Each change of
 * status goes through a conditional repository update, so two officers acting
 * on the same warning can never both succeed.
 */
@Injectable()
export class HazardWarningsService {
  constructor(
    @Inject(HAZARD_WARNING_REPOSITORY)
    private readonly warnings: HazardWarningRepository,
    @Inject(CITIZEN_DIRECTORY) private readonly citizens: CitizenDirectory,
    private readonly disseminator: WarningDisseminator,
  ) {}

  /** What the review screen shows before anything is stored. */
  async preview(
    fields: WarningFields,
    now = new Date(),
  ): Promise<WarningPreviewResult> {
    const content = toWarningContent(fields);
    reject(issueProblems(content, now));

    const [recipients, duplicates] = await Promise.all([
      this.citizens.countInDistricts(content.districts),
      this.warnings.findActiveOverlapping({
        hazardType: content.hazardType,
        districts: content.districts,
        now,
      }),
    ]);
    return { recipients, duplicates };
  }

  /** Saves a draft, or stores and sends at once. Repeating a clientRequestId returns the first result. */
  async create(
    input: CreateWarningInput,
    officer: string,
    now = new Date(),
  ): Promise<CreateWarningResult> {
    const existing = await this.warnings.findByClientRequestId(
      input.clientRequestId,
    );
    if (existing) return { warning: existing, created: false };

    const content = toWarningContent(input);
    const base = {
      ...content,
      clientRequestId: input.clientRequestId,
      createdBy: officer,
    };

    if (input.action === 'DRAFT') {
      reject(contentProblems(content));
      return this.warnings.create({ ...base, status: 'DRAFT', channels: [] });
    }

    reject(issueProblems(content, now));
    await this.refuseDuplicate(content, now, input.force);

    const result = await this.warnings.create({
      ...base,
      validFrom: content.validFrom ?? now,
      status: 'DISSEMINATING',
      issuedBy: officer,
      issuedAt: now,
      channels: initialChannels(),
    });
    // Lost a race to an identical request: that request does the sending.
    if (!result.created) return result;
    return {
      warning: await this.send(result.warning, CHANNEL_KINDS, now),
      created: true,
    };
  }

  async updateDraft(
    id: string,
    fields: WarningFields,
  ): Promise<HazardWarningEntity> {
    const content = toWarningContent(fields);
    reject(contentProblems(content));
    return this.expectUpdated(
      await this.warnings.updateDraft(id, content),
      'Only a draft can be edited',
    );
  }

  async deleteDraft(id: string): Promise<void> {
    const outcome = await this.warnings.deleteDraft(id);
    if (outcome === 'NOT_FOUND')
      throw new NotFoundException('Warning not found');
    if (outcome === 'NOT_DRAFT')
      throw new ConflictException('Only a draft can be deleted');
  }

  async issue(
    id: string,
    officer: string,
    force = false,
    now = new Date(),
  ): Promise<HazardWarningEntity> {
    const draft = await this.require(id);
    if (draft.status !== 'DRAFT')
      throw new ConflictException('Only a draft can be issued');
    reject(issueProblems(draft, now));
    await this.refuseDuplicate(draft, now, force, id);

    const started = await this.warnings.startDissemination(id, ['DRAFT'], {
      issuedBy: officer,
      issuedAt: now,
      validFrom: draft.validFrom ?? now,
      channels: initialChannels(),
    });
    const warning = this.expectUpdated(started, 'Only a draft can be issued');
    return this.send(warning, CHANNEL_KINDS, now);
  }

  /** Sends again on the channels that failed, leaving the ones that worked alone. */
  async retry(id: string, now = new Date()): Promise<HazardWarningEntity> {
    const current = await this.require(id);
    if (hasExpired(current, now)) {
      throw new ConflictException(
        'This warning has expired, so it cannot be sent again',
      );
    }
    const kinds = retryableChannels(current.channels);
    const stuck = isStuck(current, now);
    const from: WarningStatus[] = stuck
      ? [...RETRYABLE_STATUSES, 'DISSEMINATING']
      : [...RETRYABLE_STATUSES];
    if (!from.includes(current.status) || kinds.length === 0) {
      throw new ConflictException('There is nothing to retry for this warning');
    }

    const started = await this.warnings.startDissemination(id, from, {});
    const warning = this.expectUpdated(
      started,
      'There is nothing to retry for this warning',
    );
    return this.send(warning, kinds, now);
  }

  async cancel(
    id: string,
    officer: string,
    reason: string,
    now = new Date(),
  ): Promise<HazardWarningEntity> {
    const current = await this.require(id);
    if (hasExpired(current, now)) {
      // Sirens and texts for a hazard that already ended would only confuse people.
      throw new ConflictException(
        'This warning has already expired; there is nothing to cancel',
      );
    }
    const result = await this.warnings.cancel(id, {
      cancelledBy: officer,
      reason,
      cancelledAt: now,
    });
    const cancelled = this.expectUpdated(
      result,
      'This warning is not active, so it cannot be cancelled',
    );
    await this.disseminator.announceAllClear(cancelled);
    return cancelled;
  }

  private async send(
    warning: HazardWarningEntity,
    kinds: readonly ChannelKind[],
    now: Date,
  ): Promise<HazardWarningEntity> {
    const sent = await this.disseminator.send(warning, kinds, now);
    const channels = mergeChannels(warning.channels, sent);
    return this.warnings.recordDissemination(
      warning.id,
      channels,
      overallStatus(channels),
    );
  }

  private async refuseDuplicate(
    content: WarningContent,
    now: Date,
    force = false,
    excludeId?: string,
  ): Promise<void> {
    if (force) return;
    const [duplicate] = await this.warnings.findActiveOverlapping({
      hazardType: content.hazardType,
      districts: content.districts,
      now,
      ...(excludeId && { excludeId }),
    });
    if (!duplicate) return;

    const hazard = HAZARD_TYPE_LABELS[duplicate.hazardType];
    throw new ConflictException(
      `An active ${duplicate.level} ${hazard} warning (${duplicate.reference}) already covers ${describeDistricts(duplicate.districts)}. Review it, or confirm to issue anyway.`,
    );
  }

  private async require(id: string): Promise<HazardWarningEntity> {
    const warning = await this.warnings.findById(id);
    if (!warning) throw new NotFoundException('Warning not found');
    return warning;
  }

  private expectUpdated(
    result: TransitionResult,
    conflict: string,
  ): HazardWarningEntity {
    if (result.outcome === 'NOT_FOUND')
      throw new NotFoundException('Warning not found');
    if (result.outcome === 'WRONG_STATE') throw new ConflictException(conflict);
    return result.warning;
  }
}
