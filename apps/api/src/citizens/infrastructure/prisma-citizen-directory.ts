import { Injectable } from '@nestjs/common';
import type { Citizen as CitizenRow } from '@prisma/client';

import type { District } from '@repo/types';

import { PrismaService } from '../../prisma/prisma.service.js';
import { isUniqueViolation } from '../../prisma/references.js';
import type { CitizenEntity } from '../citizen.entity.js';
import type {
  CitizenDirectory,
  Recipient,
  RecipientCount,
} from '../citizen-directory.js';

function toEntity(row: CitizenRow): CitizenEntity {
  return {
    id: row.id,
    deviceId: row.deviceId,
    // Stored as a string; the DTO only lets District codes in.
    district: row.district as District,
    phone: row.phone ?? undefined,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaCitizenDirectory implements CitizenDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async register(
    deviceId: string,
    district: District,
    phone?: string,
  ): Promise<CitizenEntity> {
    const data = { district, phone: phone ?? null };
    try {
      const row = await this.prisma.citizen.upsert({
        where: { deviceId },
        create: { deviceId, ...data },
        update: data,
      });
      return toEntity(row);
    } catch (error) {
      // Two first registrations from the same device can race on the unique id.
      if (!isUniqueViolation(error, 'deviceId')) throw error;
      return toEntity(
        await this.prisma.citizen.update({ where: { deviceId }, data }),
      );
    }
  }

  async findByDeviceId(deviceId: string): Promise<CitizenEntity | null> {
    const row = await this.prisma.citizen.findUnique({ where: { deviceId } });
    return row && toEntity(row);
  }

  async findInDistricts(districts: District[]): Promise<Recipient[]> {
    const rows = await this.prisma.citizen.findMany({
      where: { district: { in: districts } },
    });
    return rows.map((row) => {
      const { deviceId, district, phone } = toEntity(row);
      return { deviceId, district, phone };
    });
  }

  async countInDistricts(districts: District[]): Promise<RecipientCount> {
    const where = { district: { in: districts } };
    const [groups, withPhone] = await Promise.all([
      this.prisma.citizen.groupBy({
        by: ['district'],
        where,
        _count: { _all: true },
      }),
      this.prisma.citizen.count({ where: { ...where, phone: { not: null } } }),
    ]);

    const byDistrict: Partial<Record<District, number>> = {};
    for (const district of districts) byDistrict[district] = 0;
    let total = 0;
    for (const group of groups) {
      byDistrict[group.district as District] = group._count._all;
      total += group._count._all;
    }
    return { total, withPhone, byDistrict };
  }
}
