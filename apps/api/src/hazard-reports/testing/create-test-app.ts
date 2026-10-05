import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { configureApp } from '../../app.setup.js';
import { CallerResolver } from '../../common/auth/caller.resolver.js';
import { OfficerGuard } from '../../common/auth/officer.guard.js';
import { OfficerOrReporterGuard } from '../../common/auth/officer-or-reporter.guard.js';
import { DECISION_NOTIFIER } from '../../notifications/decision-notifier.js';
import { PHOTO_STORAGE } from '../../storage/photo-storage.js';
import { HAZARD_REPORT_REPOSITORY } from '../hazard-report.repository.js';
import { HazardReportsController } from '../hazard-reports.controller.js';
import { HazardReportsService } from '../hazard-reports.service.js';
import {
  entity,
  fakeNotifier,
  fakePhotoStorage,
  fakeRepository,
  OFFICER_KEY,
} from './fixtures.js';

export interface TestApp {
  app: INestApplication;
  repository: ReturnType<typeof fakeRepository>;
  storage: ReturnType<typeof fakePhotoStorage>;
  notifier: ReturnType<typeof fakeNotifier>;
}

/** The real controller, service, guards, and pipeline, over fake storage and database. */
export async function createTestApp(): Promise<TestApp> {
  const repository = fakeRepository();
  const storage = fakePhotoStorage();
  const notifier = fakeNotifier();
  repository.findByClientRequestId.mockResolvedValue(null);
  repository.create.mockImplementation(async (input) => ({
    report: entity({ ...input }),
    created: true,
  }));

  const moduleRef = await Test.createTestingModule({
    controllers: [HazardReportsController],
    providers: [
      HazardReportsService,
      CallerResolver,
      OfficerGuard,
      OfficerOrReporterGuard,
      { provide: ConfigService, useValue: { get: () => OFFICER_KEY } },
      { provide: HAZARD_REPORT_REPOSITORY, useValue: repository },
      { provide: PHOTO_STORAGE, useValue: storage },
      { provide: DECISION_NOTIFIER, useValue: notifier },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, repository, storage, notifier };
}
