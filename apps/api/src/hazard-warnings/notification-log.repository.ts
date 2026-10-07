import type { NotificationLogEntity } from './domain/hazard-warning.entity.js';

export const NOTIFICATION_LOG_REPOSITORY = Symbol(
  'NOTIFICATION_LOG_REPOSITORY',
);

export type NewNotificationLog = Omit<
  NotificationLogEntity,
  'id' | 'createdAt'
>;

/** The delivery activity record, with no database types leaking out. */
export interface NotificationLogRepository {
  record(entry: NewNotificationLog): Promise<void>;
  listForWarning(
    warningId: string,
    limit: number,
  ): Promise<NotificationLogEntity[]>;
}
