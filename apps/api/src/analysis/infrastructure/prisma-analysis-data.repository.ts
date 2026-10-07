import { Injectable } from '@nestjs/common';
import type {
  DisasterEvent as EventRow,
  EventWarning as WarningRow,
  Shelter as ShelterRow,
  ShelterOccupancyRecord as OccupancyRow,
} from '@prisma/client';
import type { DistrictCode } from '@repo/types';

import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  AnalysisDataRepository,
  EventListQuery,
  EventPage,
  ResourceDistributionRecord,
} from '../analysis-data.repository.js';
import type {
  EventEntity,
  OccupancyRecordEntity,
  ShelterEntity,
  WarningEntity,
} from '../domain/analysis.entities.js';
import { sumReached } from '../reach.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

// District codes are written by the seed from the shared list, so the cast is safe.
const asDistrict = (code: string) => code as DistrictCode;

function toEvent(row: EventRow): EventEntity {
  return { ...row, districtCodes: row.districtCodes.map(asDistrict) };
}

function toWarning(row: WarningRow): WarningEntity {
  return {
    ...row,
    districts: row.districts.map((d) => ({
      ...d,
      districtCode: asDistrict(d.districtCode),
    })),
  };
}

function toShelter(row: ShelterRow): ShelterEntity {
  return { ...row, districtCode: asDistrict(row.districtCode) };
}

function toOccupancy(row: OccupancyRow): OccupancyRecordEntity {
  return row;
}

@Injectable()
export class PrismaAnalysisDataRepository implements AnalysisDataRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCompletedEvents(query: EventListQuery): Promise<EventPage> {
    const search = query.search?.trim();
    const where = {
      status: 'COMPLETED' as const,
      ...(query.hazardType && { hazardType: query.hazardType }),
      ...(query.district && { districtCodes: { has: query.district } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { eventId: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.disasterEvent.findMany({
        where,
        orderBy: { endedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.disasterEvent.count({ where }),
    ]);
    return { items: rows.map(toEvent), total };
  }

  async findEventById(id: string): Promise<EventEntity | null> {
    if (!OBJECT_ID.test(id)) return null;
    const row = await this.prisma.disasterEvent.findUnique({ where: { id } });
    return row ? toEvent(row) : null;
  }

  async findWarningsByEvent(eventId: string): Promise<WarningEntity[]> {
    const rows = await this.prisma.eventWarning.findMany({
      where: { eventId },
      orderBy: { issuedAt: 'asc' },
    });
    return rows.map(toWarning);
  }

  async countCitizensReached(
    eventId: string,
    districts?: readonly DistrictCode[],
  ): Promise<number> {
    return sumReached(await this.findWarningsByEvent(eventId), districts);
  }

  async findSheltersByEvent(eventId: string): Promise<ShelterEntity[]> {
    const rows = await this.prisma.shelter.findMany({ where: { eventId } });
    return rows.map(toShelter);
  }

  async findShelterOccupancyByEvent(
    eventId: string,
  ): Promise<OccupancyRecordEntity[]> {
    const rows = await this.prisma.shelterOccupancyRecord.findMany({
      where: { eventId },
      orderBy: { recordedAt: 'asc' },
    });
    return rows.map(toOccupancy);
  }

  async findResourceDistributions(
    eventId: string,
  ): Promise<ResourceDistributionRecord[]> {
    const rows = await this.prisma.resourceDistribution.findMany({
      where: { eventId },
      orderBy: { distributedAt: 'asc' },
    });
    const [resources, organisations] = await Promise.all([
      this.prisma.resource.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.resourceId))] } },
      }),
      this.prisma.organisation.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.organisationId))] } },
      }),
    ]);
    const resourceById = new Map(resources.map((r) => [r.id, r]));
    const organisationById = new Map(organisations.map((o) => [o.id, o]));
    return rows.map((row) => ({
      ...row,
      districtCode: asDistrict(row.districtCode),
      resourceName:
        resourceById.get(row.resourceId)?.resourceName ?? 'Unknown resource',
      resourceType: resourceById.get(row.resourceId)?.resourceType ?? 'OTHER',
      organisationName:
        organisationById.get(row.organisationId)?.organisationName ??
        'Unknown organisation',
    }));
  }
}
