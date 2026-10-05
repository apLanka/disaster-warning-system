import { Module } from '@nestjs/common';

import { CallerResolver } from '../common/auth/caller.resolver.js';
import { OfficerGuard } from '../common/auth/officer.guard.js';
import { OfficerOrReporterGuard } from '../common/auth/officer-or-reporter.guard.js';
import { DECISION_NOTIFIER } from '../notifications/decision-notifier.js';
import { NoopDecisionNotifier } from '../notifications/noop-decision-notifier.js';
import { StorageModule } from '../storage/storage.module.js';
import { HAZARD_REPORT_REPOSITORY } from './hazard-report.repository.js';
import { HazardReportsController } from './hazard-reports.controller.js';
import { HazardReportsService } from './hazard-reports.service.js';
import { PrismaHazardReportRepository } from './infrastructure/prisma-hazard-report.repository.js';

@Module({
  imports: [StorageModule],
  controllers: [HazardReportsController],
  providers: [
    HazardReportsService,
    CallerResolver,
    OfficerGuard,
    OfficerOrReporterGuard,
    {
      provide: HAZARD_REPORT_REPOSITORY,
      useClass: PrismaHazardReportRepository,
    },
    // TODO(T6): replaced by the notifications module's real notifier.
    { provide: DECISION_NOTIFIER, useClass: NoopDecisionNotifier },
  ],
  exports: [HazardReportsService, HAZARD_REPORT_REPOSITORY],
})
export class HazardReportsModule {}
