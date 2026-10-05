import { Module } from '@nestjs/common';

import { HAZARD_REPORT_REPOSITORY } from './hazard-report.repository.js';
import { PrismaHazardReportRepository } from './infrastructure/prisma-hazard-report.repository.js';

@Module({
  providers: [
    {
      provide: HAZARD_REPORT_REPOSITORY,
      useClass: PrismaHazardReportRepository,
    },
  ],
  exports: [HAZARD_REPORT_REPOSITORY],
})
export class HazardReportsModule {}
