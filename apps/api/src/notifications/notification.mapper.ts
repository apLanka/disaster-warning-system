import type { NotificationDto } from '@repo/types';

import type { NotificationEntity } from './notification.entity.js';

export function toNotificationDto(entity: NotificationEntity): NotificationDto {
  return {
    id: entity.id,
    reporterId: entity.reporterId,
    reportId: entity.reportId,
    kind: entity.kind,
    title: entity.title,
    message: entity.message,
    readAt: entity.readAt?.toISOString() ?? null,
    createdAt: entity.createdAt.toISOString(),
  };
}
