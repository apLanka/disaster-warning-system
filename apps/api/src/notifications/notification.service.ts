import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { REJECTION_REASON_LABELS } from '@repo/types';

import type { HazardReportEntity } from '../hazard-reports/domain/hazard-report.entity.js';
import type { DecisionNotifier } from './decision-notifier.js';
import type { NotificationEntity } from './notification.entity.js';
import { NOTIFICATION_REPOSITORY } from './notification.repository.js';
import type {
  NewNotification,
  NotificationListOptions,
  NotificationRepository,
} from './notification.repository.js';

/**
 * Words for the reporter. Only what the officer wrote *for the reporter*
 * (the reason and its details) is used. Internal notes and the officer's
 * name never reach this text.
 */
function composeRejection(report: HazardReportEntity): string {
  const { rejectionReason, rejectionDetails } = report.decision ?? {};
  const prefix = `Your hazard report ${report.reference} was not accepted.`;

  if (!rejectionReason) return prefix;
  if (rejectionReason === 'OTHER') {
    return rejectionDetails ? `${prefix} ${rejectionDetails}` : prefix;
  }

  const reason = `Reason: ${REJECTION_REASON_LABELS[rejectionReason]}.`;
  return rejectionDetails
    ? `${prefix} ${reason} ${rejectionDetails}`
    : `${prefix} ${reason}`;
}

function composeNotification(report: HazardReportEntity): NewNotification {
  const base = { reporterId: report.reporterId, reportId: report.id };

  if (report.status === 'VERIFIED') {
    return {
      ...base,
      kind: 'REPORT_VERIFIED',
      title: 'Report verified',
      message: `Your hazard report ${report.reference} has been verified by the Disaster Management Centre.`,
    };
  }
  if (report.status === 'REJECTED') {
    return {
      ...base,
      kind: 'REPORT_REJECTED',
      title: 'Report rejected',
      message: composeRejection(report),
    };
  }
  throw new Error(
    `Cannot notify about report ${report.reference}: it has not been decided`,
  );
}

@Injectable()
export class NotificationService implements DecisionNotifier {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
  ) {}

  async notifyDecision(report: HazardReportEntity): Promise<void> {
    await this.notifications.create(composeNotification(report));
  }

  listForReporter(
    reporterId: string,
    options: NotificationListOptions,
  ): Promise<NotificationEntity[]> {
    return this.notifications.listByReporter(reporterId, options);
  }

  async markRead(id: string, reporterId: string): Promise<NotificationEntity> {
    const notification = await this.notifications.markRead(id, reporterId);
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }
}
