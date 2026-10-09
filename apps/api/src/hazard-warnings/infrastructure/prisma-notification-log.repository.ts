import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { NotificationLogEntity } from '../domain/hazard-warning.entity.js';
import type {
  NewNotificationLog,
  NotificationLogRepository,
} from '../notification-log.repository.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

@Injectable()
export class PrismaNotificationLogRepository implements NotificationLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: NewNotificationLog): Promise<void> {
    await this.prisma.notificationLog.create({ data: entry });
  }

  async listForWarning(
    warningId: string,
    limit: number,
  ): Promise<NotificationLogEntity[]> {
    if (!OBJECT_ID.test(warningId)) return [];
    return this.prisma.notificationLog.findMany({
      where: { warningId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }
}
