import type { NotificationEntity } from './notification.entity.js';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export type NewNotification = Pick<
  NotificationEntity,
  'reporterId' | 'reportId' | 'kind' | 'title' | 'message'
>;

export interface NotificationListOptions {
  unreadOnly: boolean;
  limit: number;
}

export interface NotificationRepository {
  create(input: NewNotification): Promise<NotificationEntity>;
  /** Newest first. */
  listByReporter(
    reporterId: string,
    options: NotificationListOptions,
  ): Promise<NotificationEntity[]>;
  /**
   * Marks one of the reporter's notifications as read. Safe to repeat: the
   * first read time is kept. Returns null if it does not exist or belongs to
   * someone else.
   */
  markRead(id: string, reporterId: string): Promise<NotificationEntity | null>;
}
