import { Injectable } from '@nestjs/common';
import type { Notification as NotificationRow, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { NotificationEntity } from '../notification.entity.js';
import type {
  NewNotification,
  NotificationListOptions,
  NotificationRepository,
} from '../notification.repository.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

// MongoDB tells "set to null" apart from "never set", and new notifications
// never set readAt, so `readAt: null` alone would match none of them.
const UNREAD = {
  OR: [{ readAt: null }, { readAt: { isSet: false } }],
} satisfies Prisma.NotificationWhereInput;

function toEntity(row: NotificationRow): NotificationEntity {
  return {
    id: row.id,
    reporterId: row.reporterId,
    reportId: row.reportId,
    kind: row.kind,
    title: row.title,
    message: row.message,
    readAt: row.readAt ?? undefined,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: NewNotification): Promise<NotificationEntity> {
    return toEntity(await this.prisma.notification.create({ data: input }));
  }

  async listByReporter(
    reporterId: string,
    options: NotificationListOptions,
  ): Promise<NotificationEntity[]> {
    const rows = await this.prisma.notification.findMany({
      where: { reporterId, ...(options.unreadOnly && UNREAD) },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: options.limit,
    });
    return rows.map(toEntity);
  }

  async markRead(
    id: string,
    reporterId: string,
  ): Promise<NotificationEntity | null> {
    if (!OBJECT_ID.test(id)) return null;

    // Matching only unread rows keeps the first read time when this is repeated,
    // and matching the reporter means nobody can mark someone else's notification.
    await this.prisma.notification.updateMany({
      where: { id, reporterId, ...UNREAD },
      data: { readAt: new Date() },
    });

    const row = await this.prisma.notification.findFirst({
      where: { id, reporterId },
    });
    return row && toEntity(row);
  }
}
