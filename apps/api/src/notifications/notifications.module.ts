import { Module } from '@nestjs/common';

import { DECISION_NOTIFIER } from './decision-notifier.js';
import { PrismaNotificationRepository } from './infrastructure/prisma-notification.repository.js';
import { NOTIFICATION_REPOSITORY } from './notification.repository.js';
import { NotificationService } from './notification.service.js';
import { NotificationsController } from './notifications.controller.js';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: PrismaNotificationRepository,
    },
    // Hazard reports depend on the port, not on this module's service.
    { provide: DECISION_NOTIFIER, useExisting: NotificationService },
  ],
  exports: [DECISION_NOTIFIER],
})
export class NotificationsModule {}
