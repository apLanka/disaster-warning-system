import { Injectable } from '@nestjs/common';
import type { HazardWarning as HazardWarningRow, Prisma } from '@prisma/client';

import {
  ISSUED_STATUSES,
  type District,
  type Paginated,
  type WarningStats,
  type WarningStatus,
  type WarningView,
} from '@repo/types';

import { PrismaService } from '../../prisma/prisma.service.js';
import { isUniqueViolation, nextReference } from '../../prisma/references.js';
import type {
  DisseminationChannelState,
  HazardWarningEntity,
  WarningContent,
} from '../domain/hazard-warning.entity.js';
import type {
  CancelInput,
  CreateWarningResult,
  DisseminationStart,
  HazardWarningRepository,
  NewWarning,
  OverlapQuery,
  TransitionResult,
  WarningListQuery,
} from '../hazard-warning.repository.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const ISSUED = [...ISSUED_STATUSES];

function toChannel(
  item: HazardWarningRow['channels'][number],
): DisseminationChannelState {
  return {
    channel: item.channel,
    state: item.state,
    recipients: item.recipients,
    delivered: item.delivered,
    attempts: item.attempts,
    lastError: item.lastError ?? undefined,
    sentAt: item.sentAt ?? undefined,
  };
}

function toEntity(row: HazardWarningRow): HazardWarningEntity {
  return {
    id: row.id,
    reference: row.reference,
    clientRequestId: row.clientRequestId,
    hazardType: row.hazardType,
    level: row.level,
    description: row.description ?? undefined,
    additionalInfo: row.additionalInfo ?? undefined,
    safetyInstructions: row.safetyInstructions,
    // Stored as strings; the DTO only ever lets District codes in.
    districts: row.districts as District[],
    validFrom: row.validFrom ?? undefined,
    validUntil: row.validUntil ?? undefined,
    sourceReportId: row.sourceReportId ?? undefined,
    status: row.status,
    channels: row.channels.map(toChannel),
    createdBy: row.createdBy,
    issuedBy: row.issuedBy ?? undefined,
    issuedAt: row.issuedAt ?? undefined,
    cancellation:
      row.cancelledAt && row.cancelledBy && row.cancelReason
        ? {
            cancelledAt: row.cancelledAt,
            cancelledBy: row.cancelledBy,
            reason: row.cancelReason,
          }
        : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Optional fields become null so an edit can clear them. */
function contentData(content: WarningContent) {
  return {
    hazardType: content.hazardType,
    level: content.level,
    description: content.description ?? null,
    additionalInfo: content.additionalInfo ?? null,
    safetyInstructions: content.safetyInstructions,
    districts: content.districts,
    validFrom: content.validFrom ?? null,
    validUntil: content.validUntil ?? null,
    sourceReportId: content.sourceReportId ?? null,
  };
}

function channelData(channels: DisseminationChannelState[]) {
  return channels.map((item) => ({
    channel: item.channel,
    state: item.state,
    recipients: item.recipients,
    delivered: item.delivered,
    attempts: item.attempts,
    lastError: item.lastError ?? null,
    sentAt: item.sentAt ?? null,
  }));
}

function viewQuery(view: WarningView, now: Date) {
  const issued = { status: { in: ISSUED } };
  const byNewest = (field: 'issuedAt' | 'updatedAt') => [
    { [field]: 'desc' as const },
    { id: 'asc' as const },
  ];

  if (view === 'drafts') {
    return {
      where: { status: 'DRAFT' as const },
      orderBy: byNewest('updatedAt'),
    };
  }
  if (view === 'past') {
    return {
      where: {
        OR: [
          { status: 'CANCELLED' as const },
          { ...issued, validUntil: { lte: now } },
        ],
      },
      orderBy: byNewest('updatedAt'),
    };
  }
  return {
    where: { ...issued, validUntil: { gt: now } },
    orderBy: byNewest('issuedAt'),
  };
}

@Injectable()
export class PrismaHazardWarningRepository implements HazardWarningRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: NewWarning): Promise<CreateWarningResult> {
    const reference = await nextReference(this.prisma, 'HW');
    try {
      const row = await this.prisma.hazardWarning.create({
        data: {
          ...contentData(input),
          reference,
          clientRequestId: input.clientRequestId,
          status: input.status,
          channels: channelData(input.channels),
          createdBy: input.createdBy,
          issuedBy: input.issuedBy ?? null,
          issuedAt: input.issuedAt ?? null,
        },
      });
      return { warning: toEntity(row), created: true };
    } catch (error) {
      if (isUniqueViolation(error, 'clientRequestId')) {
        const existing = await this.findByClientRequestId(
          input.clientRequestId,
        );
        if (existing) return { warning: existing, created: false };
      }
      throw error;
    }
  }

  async findById(id: string): Promise<HazardWarningEntity | null> {
    if (!OBJECT_ID.test(id)) return null;
    const row = await this.prisma.hazardWarning.findUnique({ where: { id } });
    return row && toEntity(row);
  }

  async findByIds(ids: string[]): Promise<HazardWarningEntity[]> {
    const valid = ids.filter((id) => OBJECT_ID.test(id));
    if (valid.length === 0) return [];
    const rows = await this.prisma.hazardWarning.findMany({
      where: { id: { in: valid } },
    });
    return rows.map(toEntity);
  }

  async findByClientRequestId(
    clientRequestId: string,
  ): Promise<HazardWarningEntity | null> {
    const row = await this.prisma.hazardWarning.findUnique({
      where: { clientRequestId },
    });
    return row && toEntity(row);
  }

  updateDraft(id: string, content: WarningContent): Promise<TransitionResult> {
    return this.transition(id, ['DRAFT'], contentData(content));
  }

  async deleteDraft(
    id: string,
  ): Promise<'DELETED' | 'NOT_DRAFT' | 'NOT_FOUND'> {
    if (!OBJECT_ID.test(id)) return 'NOT_FOUND';
    const { count } = await this.prisma.hazardWarning.deleteMany({
      where: { id, status: 'DRAFT' },
    });
    if (count > 0) return 'DELETED';
    const row = await this.prisma.hazardWarning.findUnique({ where: { id } });
    return row ? 'NOT_DRAFT' : 'NOT_FOUND';
  }

  startDissemination(
    id: string,
    from: readonly WarningStatus[],
    changes: DisseminationStart,
  ): Promise<TransitionResult> {
    return this.transition(id, from, {
      status: 'DISSEMINATING',
      ...(changes.issuedBy !== undefined && { issuedBy: changes.issuedBy }),
      ...(changes.issuedAt !== undefined && { issuedAt: changes.issuedAt }),
      ...(changes.validFrom !== undefined && { validFrom: changes.validFrom }),
      ...(changes.channels !== undefined && {
        channels: { set: channelData(changes.channels) },
      }),
    });
  }

  async recordDissemination(
    id: string,
    channels: DisseminationChannelState[],
    status: WarningStatus,
  ): Promise<HazardWarningEntity> {
    // Guarded so a cancel that landed mid-send is never overwritten.
    await this.prisma.hazardWarning.updateMany({
      where: { id, status: 'DISSEMINATING' },
      data: { status, channels: { set: channelData(channels) } },
    });
    const row = await this.prisma.hazardWarning.findUnique({ where: { id } });
    if (!row)
      throw new Error(`Warning ${id} disappeared while it was being sent`);
    return toEntity(row);
  }

  cancel(id: string, input: CancelInput): Promise<TransitionResult> {
    return this.transition(id, ISSUED, {
      status: 'CANCELLED',
      cancelledAt: input.cancelledAt,
      cancelledBy: input.cancelledBy,
      cancelReason: input.reason,
    });
  }

  async findActiveOverlapping(
    query: OverlapQuery,
  ): Promise<HazardWarningEntity[]> {
    const rows = await this.prisma.hazardWarning.findMany({
      where: {
        hazardType: query.hazardType,
        districts: { hasSome: query.districts },
        status: { in: ISSUED },
        validUntil: { gt: query.now },
        ...(query.excludeId && { id: { not: query.excludeId } }),
      },
      orderBy: { issuedAt: 'desc' },
    });
    return rows.map(toEntity);
  }

  async list(query: WarningListQuery): Promise<Paginated<HazardWarningEntity>> {
    const { where, orderBy } = viewQuery(query.view, query.now);
    const [rows, total] = await Promise.all([
      this.prisma.hazardWarning.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.hazardWarning.count({ where }),
    ]);
    return {
      items: rows.map(toEntity),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async stats(now: Date, todayStart: Date): Promise<WarningStats> {
    const [active, drafts, issuedToday] = await Promise.all([
      this.prisma.hazardWarning.count({
        where: { status: { in: ISSUED }, validUntil: { gt: now } },
      }),
      this.prisma.hazardWarning.count({ where: { status: 'DRAFT' } }),
      this.prisma.hazardWarning.count({
        where: { issuedAt: { gte: todayStart } },
      }),
    ]);
    return { active, drafts, issuedToday };
  }

  /**
   * The status filter is the guard: of two concurrent changes to the same
   * warning only one update can match, so each transition happens once.
   */
  private async transition(
    id: string,
    from: readonly WarningStatus[],
    data: Prisma.HazardWarningUpdateManyMutationInput,
  ): Promise<TransitionResult> {
    if (!OBJECT_ID.test(id)) return { outcome: 'NOT_FOUND' };

    const { count } = await this.prisma.hazardWarning.updateMany({
      where: { id, status: { in: [...from] } },
      data,
    });
    const row = await this.prisma.hazardWarning.findUnique({ where: { id } });
    if (!row) return { outcome: 'NOT_FOUND' };
    return {
      outcome: count === 0 ? 'WRONG_STATE' : 'UPDATED',
      warning: toEntity(row),
    };
  }
}
