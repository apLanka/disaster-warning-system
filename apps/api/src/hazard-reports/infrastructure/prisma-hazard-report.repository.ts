import { Injectable } from '@nestjs/common';
import type { HazardReport as HazardReportRow, Prisma } from '@prisma/client';

import type { Paginated, ReportStats } from '@repo/types';

import { PrismaService } from '../../prisma/prisma.service.js';
import { isUniqueViolation, nextReference } from '../../prisma/references.js';
import type { HazardReportEntity } from '../domain/hazard-report.entity.js';
import type {
  CreateResult,
  DecideResult,
  HazardReportRepository,
  NewHazardReport,
  ReportDecisionInput,
  ReportListQuery,
} from '../hazard-report.repository.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const DEFAULT_MINE_LIMIT = 100;

function toEntity(row: HazardReportRow): HazardReportEntity {
  return {
    id: row.id,
    reference: row.reference,
    reporterId: row.reporterId,
    clientRequestId: row.clientRequestId,
    reporterName: row.reporterName ?? undefined,
    reporterContact: row.reporterContact ?? undefined,
    type: row.type,
    description: row.description,
    location: row.location,
    photos: row.photos,
    status: row.status,
    decision:
      row.decidedAt && row.decidedBy
        ? {
            decidedAt: row.decidedAt,
            decidedBy: row.decidedBy,
            officerNotes: row.officerNotes ?? undefined,
            rejectionReason: row.rejectionReason ?? undefined,
            rejectionDetails: row.rejectionDetails ?? undefined,
          }
        : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaHazardReportRepository implements HazardReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: NewHazardReport): Promise<CreateResult> {
    const reference = await nextReference(this.prisma, 'HR');

    try {
      const row = await this.prisma.hazardReport.create({
        data: { ...input, reference },
      });
      return { report: toEntity(row), created: true };
    } catch (error) {
      if (isUniqueViolation(error, 'clientRequestId')) {
        const existing = await this.findByClientRequestId(
          input.clientRequestId,
        );
        if (existing) return { report: existing, created: false };
      }
      throw error;
    }
  }

  async findById(id: string): Promise<HazardReportEntity | null> {
    if (!OBJECT_ID.test(id)) return null;
    const row = await this.prisma.hazardReport.findUnique({ where: { id } });
    return row && toEntity(row);
  }

  async findByClientRequestId(
    clientRequestId: string,
  ): Promise<HazardReportEntity | null> {
    const row = await this.prisma.hazardReport.findUnique({
      where: { clientRequestId },
    });
    return row && toEntity(row);
  }

  async findByReporter(
    reporterId: string,
    limit = DEFAULT_MINE_LIMIT,
  ): Promise<HazardReportEntity[]> {
    const rows = await this.prisma.hazardReport.findMany({
      where: { reporterId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit,
    });
    return rows.map(toEntity);
  }

  async list(query: ReportListQuery): Promise<Paginated<HazardReportEntity>> {
    const where: Prisma.HazardReportWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.type && { type: query.type }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.hazardReport.findMany({
        where,
        orderBy: [
          { createdAt: query.sort === 'oldest' ? 'asc' : 'desc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.hazardReport.count({ where }),
    ]);

    return {
      items: rows.map(toEntity),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async stats(verifiedSince: Date): Promise<ReportStats> {
    const [pending, verifiedToday, rejected, total] = await Promise.all([
      this.prisma.hazardReport.count({
        where: { status: 'PENDING_VERIFICATION' },
      }),
      this.prisma.hazardReport.count({
        where: { status: 'VERIFIED', decidedAt: { gte: verifiedSince } },
      }),
      this.prisma.hazardReport.count({ where: { status: 'REJECTED' } }),
      this.prisma.hazardReport.count(),
    ]);
    return { pending, verifiedToday, rejected, total };
  }

  async decide(
    id: string,
    decision: ReportDecisionInput,
  ): Promise<DecideResult> {
    if (!OBJECT_ID.test(id)) return { outcome: 'NOT_FOUND' };

    // The status filter is the guard: of two concurrent decisions on the same
    // report, only one update can match, so a report is decided exactly once.
    const { count } = await this.prisma.hazardReport.updateMany({
      where: { id, status: 'PENDING_VERIFICATION' },
      data: {
        status: decision.status,
        decidedAt: new Date(),
        decidedBy: decision.decidedBy,
        officerNotes: decision.officerNotes,
        rejectionReason: decision.rejectionReason,
        rejectionDetails: decision.rejectionDetails,
      },
    });

    const row = await this.prisma.hazardReport.findUnique({ where: { id } });
    if (!row) return { outcome: 'NOT_FOUND' };
    if (count === 0) return { outcome: 'ALREADY_DECIDED' };
    return { outcome: 'DECIDED', report: toEntity(row) };
  }
}
