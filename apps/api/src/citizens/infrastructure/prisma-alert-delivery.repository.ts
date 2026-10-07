import { Injectable } from '@nestjs/common';
import type { AlertDelivery as AlertDeliveryRow } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import { isUniqueViolation } from '../../prisma/references.js';
import type { AlertDeliveryRepository } from '../alert-delivery.repository.js';
import type { AlertDeliveryEntity } from '../citizen.entity.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

function toEntity(row: AlertDeliveryRow): AlertDeliveryEntity {
  return {
    id: row.id,
    warningId: row.warningId,
    deviceId: row.deviceId,
    deliveredAt: row.deliveredAt,
    acknowledgedAt: row.acknowledgedAt ?? undefined,
  };
}

@Injectable()
export class PrismaAlertDeliveryRepository implements AlertDeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordDelivered(
    warningId: string,
    deviceIds: string[],
  ): Promise<number> {
    const unique = [...new Set(deviceIds)];
    if (unique.length === 0) return 0;

    const existing = await this.prisma.alertDelivery.findMany({
      where: { warningId, deviceId: { in: unique } },
      select: { deviceId: true },
    });
    const have = new Set(existing.map((row) => row.deviceId));
    const missing = unique.filter((deviceId) => !have.has(deviceId));

    if (missing.length > 0) {
      try {
        await this.prisma.alertDelivery.createMany({
          // acknowledgedAt is written as null so "not acknowledged" can be queried.
          data: missing.map((deviceId) => ({
            warningId,
            deviceId,
            acknowledgedAt: null,
          })),
        });
      } catch (error) {
        // A parallel send delivered some of these first; they are delivered either way.
        if (!isUniqueViolation(error, 'warningId')) throw error;
      }
    }
    return unique.length;
  }

  async listForDevice(
    deviceId: string,
    limit: number,
  ): Promise<AlertDeliveryEntity[]> {
    const rows = await this.prisma.alertDelivery.findMany({
      where: { deviceId },
      orderBy: { deliveredAt: 'desc' },
      take: limit,
    });
    return rows.map(toEntity);
  }

  async acknowledge(
    warningId: string,
    deviceId: string,
    at: Date,
  ): Promise<AlertDeliveryEntity | null> {
    if (!OBJECT_ID.test(warningId)) return null;
    await this.prisma.alertDelivery.updateMany({
      where: { warningId, deviceId, acknowledgedAt: null },
      data: { acknowledgedAt: at },
    });
    const row = await this.prisma.alertDelivery.findUnique({
      where: { warningId_deviceId: { warningId, deviceId } },
    });
    return row && toEntity(row);
  }

  countAcknowledged(warningId: string): Promise<number> {
    return this.prisma.alertDelivery.count({
      where: { warningId, acknowledgedAt: { not: null } },
    });
  }
}
