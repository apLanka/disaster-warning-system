import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { configureApp } from '../../app.setup.js';
import { CallerResolver } from '../../common/auth/caller.resolver.js';
import { OfficerGuard } from '../../common/auth/officer.guard.js';
import { ANALYSIS_DATA_REPOSITORY } from '../analysis-data.repository.js';
import { DisasterAnalysisService } from '../disaster-analysis.service.js';
import type { FakeDataset } from '../domain/analysis.entities.js';
import { buildFakeDataset } from '../fake-data/build-fake-dataset.js';
import { PostDisasterReportController } from '../post-disaster-report.controller.js';
import { InMemoryAnalysisDataRepository } from './in-memory-analysis-data.repository.js';

export const ANALYSIS_OFFICER_KEY = 'test-officer-key-0123456789';

export interface AnalysisTestApp {
  app: INestApplication;
  dataset: FakeDataset;
  /** The database id of an event, by its reference (for example DE-2026-0001). */
  idOf: (eventId: string) => string;
}

/** The real controller, service, guards, and pipeline over the fake dataset in memory. */
export async function createAnalysisTestApp(
  dataset: FakeDataset = buildFakeDataset(),
): Promise<AnalysisTestApp> {
  const moduleRef = await Test.createTestingModule({
    controllers: [PostDisasterReportController],
    providers: [
      DisasterAnalysisService,
      CallerResolver,
      OfficerGuard,
      { provide: ConfigService, useValue: { get: () => ANALYSIS_OFFICER_KEY } },
      {
        provide: ANALYSIS_DATA_REPOSITORY,
        useValue: new InMemoryAnalysisDataRepository(dataset),
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return {
    app,
    dataset,
    idOf: (eventId) => {
      const event = dataset.events.find((e) => e.eventId === eventId);
      if (!event) throw new Error(`No event ${eventId} in the dataset`);
      return event.id;
    },
  };
}
