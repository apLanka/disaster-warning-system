import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { configureApp } from '../../app.setup.js';
import { ALERT_DELIVERY_REPOSITORY } from '../../citizens/alert-delivery.repository.js';
import { CITIZEN_DIRECTORY } from '../../citizens/citizen-directory.js';
import { CitizensController } from '../../citizens/citizens.controller.js';
import { CitizensService } from '../../citizens/citizens.service.js';
import { CallerResolver } from '../../common/auth/caller.resolver.js';
import { OfficerGuard } from '../../common/auth/officer.guard.js';
import { HAZARD_REPORT_REPOSITORY } from '../../hazard-reports/hazard-report.repository.js';
import {
  fakeRepository as fakeReportRepository,
  OFFICER_KEY,
} from '../../hazard-reports/testing/fixtures.js';
import { AlertsController } from '../alerts.controller.js';
import { CitizenAlertsService } from '../citizen-alerts.service.js';
import { AudibleAlertChannel } from '../dissemination/audible-alert.channel.js';
import { ChannelFailureSwitch } from '../dissemination/channel-failure-switch.js';
import { InAppPushChannel } from '../dissemination/in-app-push.channel.js';
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
} from '../dissemination/notification-channel.js';
import { SmsChannel } from '../dissemination/sms.channel.js';
import { WarningDisseminator } from '../dissemination/warning-disseminator.js';
import { HAZARD_WARNING_REPOSITORY } from '../hazard-warning.repository.js';
import { HazardWarningsController } from '../hazard-warnings.controller.js';
import { HazardWarningsService } from '../hazard-warnings.service.js';
import { NOTIFICATION_LOG_REPOSITORY } from '../notification-log.repository.js';
import { WarningQueriesService } from '../warning-queries.service.js';
import {
  fakeDeliveries,
  fakeDirectory,
  fakeLogRepository,
  fakeWarningRepository,
} from './fixtures.js';

export interface WarningsTestApp {
  app: INestApplication;
  warnings: ReturnType<typeof fakeWarningRepository>;
  directory: ReturnType<typeof fakeDirectory>;
  deliveries: ReturnType<typeof fakeDeliveries>;
  logs: ReturnType<typeof fakeLogRepository>;
  reports: ReturnType<typeof fakeReportRepository>;
}

/** Real controllers, services, channels, guards and pipeline over fake storage. */
export async function createWarningsApp(
  failingChannels: string[] = [],
): Promise<WarningsTestApp> {
  const warnings = fakeWarningRepository();
  const directory = fakeDirectory();
  const deliveries = fakeDeliveries();
  const logs = fakeLogRepository();
  const reports = fakeReportRepository();
  const config = {
    get: (key: string) =>
      key === 'SIMULATE_CHANNEL_FAILURE' ? failingChannels : OFFICER_KEY,
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [
      HazardWarningsController,
      AlertsController,
      CitizensController,
    ],
    providers: [
      HazardWarningsService,
      WarningQueriesService,
      CitizenAlertsService,
      CitizensService,
      WarningDisseminator,
      ChannelFailureSwitch,
      InAppPushChannel,
      SmsChannel,
      AudibleAlertChannel,
      {
        provide: NOTIFICATION_CHANNELS,
        useFactory: (...channels: NotificationChannel[]) => channels,
        inject: [InAppPushChannel, SmsChannel, AudibleAlertChannel],
      },
      CallerResolver,
      OfficerGuard,
      { provide: ConfigService, useValue: config },
      { provide: HAZARD_WARNING_REPOSITORY, useValue: warnings },
      { provide: NOTIFICATION_LOG_REPOSITORY, useValue: logs },
      { provide: CITIZEN_DIRECTORY, useValue: directory },
      { provide: ALERT_DELIVERY_REPOSITORY, useValue: deliveries },
      { provide: HAZARD_REPORT_REPOSITORY, useValue: reports },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, warnings, directory, deliveries, logs, reports };
}
