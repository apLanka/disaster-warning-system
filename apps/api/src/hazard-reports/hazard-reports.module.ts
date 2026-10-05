import { Module } from '@nestjs/common';

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
    {
      provide: HAZARD_REPORT_REPOSITORY,
      useClass: PrismaHazardReportRepository,
    },
  ],
  exports: [HazardReportsService, HAZARD_REPORT_REPOSITORY],
})
export class HazardReportsModule {}
