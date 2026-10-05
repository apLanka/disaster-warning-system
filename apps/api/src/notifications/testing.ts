import type { NotificationEntity } from './notification.entity.js';
import type { NotificationRepository } from './notification.repository.js';

export function notification(
  overrides: Partial<NotificationEntity> = {},
): NotificationEntity {
  return {
    id: '665f1f77bcf86cd799439021',
    reporterId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    reportId: '665f1f77bcf86cd799439011',
    kind: 'REPORT_VERIFIED',
    title: 'Report verified',
    message: 'Your hazard report HR-2026-0001 has been verified.',
    createdAt: new Date('2026-10-05T07:00:00.000Z'),
    ...overrides,
  };
}

export function fakeNotificationRepository() {
  return {
    create: vi.fn<NotificationRepository['create']>(),
    listByReporter: vi.fn<NotificationRepository['listByReporter']>(),
    markRead: vi.fn<NotificationRepository['markRead']>(),
  };
}
