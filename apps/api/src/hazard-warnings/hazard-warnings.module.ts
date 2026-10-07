import { Module } from '@nestjs/common';

import { CitizensModule } from '../citizens/citizens.module.js';
import { CallerResolver } from '../common/auth/caller.resolver.js';
import { OfficerGuard } from '../common/auth/officer.guard.js';
import { HazardReportsModule } from '../hazard-reports/hazard-reports.module.js';
import { AlertsController } from './alerts.controller.js';
import { CitizenAlertsService } from './citizen-alerts.service.js';
import { AudibleAlertChannel } from './dissemination/audible-alert.channel.js';
import { ChannelFailureSwitch } from './dissemination/channel-failure-switch.js';
import { InAppPushChannel } from './dissemination/in-app-push.channel.js';
import { NOTIFICATION_CHANNELS } from './dissemination/notification-channel.js';
import type { NotificationChannel } from './dissemination/notification-channel.js';
import { SmsChannel } from './dissemination/sms.channel.js';
import { WarningDisseminator } from './dissemination/warning-disseminator.js';
import { HAZARD_WARNING_REPOSITORY } from './hazard-warning.repository.js';
import { HazardWarningsController } from './hazard-warnings.controller.js';
import { HazardWarningsService } from './hazard-warnings.service.js';
import { PrismaHazardWarningRepository } from './infrastructure/prisma-hazard-warning.repository.js';
import { PrismaNotificationLogRepository } from './infrastructure/prisma-notification-log.repository.js';
import { NOTIFICATION_LOG_REPOSITORY } from './notification-log.repository.js';
import { WarningQueriesService } from './warning-queries.service.js';

@Module({
  imports: [CitizensModule, HazardReportsModule],
  controllers: [HazardWarningsController, AlertsController],
  providers: [
    HazardWarningsService,
    WarningQueriesService,
    CitizenAlertsService,
    WarningDisseminator,
    ChannelFailureSwitch,
    InAppPushChannel,
    SmsChannel,
    AudibleAlertChannel,
    // The order here is the order channels are sent and shown.
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (...channels: NotificationChannel[]) => channels,
      inject: [InAppPushChannel, SmsChannel, AudibleAlertChannel],
    },
    CallerResolver,
    OfficerGuard,
    {
      provide: HAZARD_WARNING_REPOSITORY,
      useClass: PrismaHazardWarningRepository,
    },
    {
      provide: NOTIFICATION_LOG_REPOSITORY,
      useClass: PrismaNotificationLogRepository,
    },
  ],
})
export class HazardWarningsModule {}
