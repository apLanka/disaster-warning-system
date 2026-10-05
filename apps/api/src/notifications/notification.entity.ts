import type { NotificationKind } from '@repo/types';

export interface NotificationEntity {
  id: string;
  reporterId: string;
  reportId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  readAt?: Date;
  createdAt: Date;
}
