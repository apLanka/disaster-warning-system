import { Module } from '@nestjs/common';

import { CallerResolver } from '../common/auth/caller.resolver.js';
import { OfficerGuard } from '../common/auth/officer.guard.js';
import { ANALYSIS_DATA_REPOSITORY } from './analysis-data.repository.js';
import { DisasterAnalysisService } from './disaster-analysis.service.js';
import { PrismaAnalysisDataRepository } from './infrastructure/prisma-analysis-data.repository.js';
import { PostDisasterReportController } from './post-disaster-report.controller.js';

@Module({
  controllers: [PostDisasterReportController],
  providers: [
    DisasterAnalysisService,
    CallerResolver,
    OfficerGuard,
    {
      provide: ANALYSIS_DATA_REPOSITORY,
      useClass: PrismaAnalysisDataRepository,
    },
  ],
})
export class AnalysisModule {}
