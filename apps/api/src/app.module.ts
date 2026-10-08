import { Module } from '@nestjs/common';

import { AnalysisModule } from './analysis/analysis.module.js';
import { CitizensModule } from './citizens/citizens.module.js';
import { AppConfigModule } from './config/app-config.module.js';
import { HazardReportsModule } from './hazard-reports/hazard-reports.module.js';
import { HazardWarningsModule } from './hazard-warnings/hazard-warnings.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    HazardReportsModule,
    AnalysisModule,
    NotificationsModule,
    CitizensModule,
    HazardWarningsModule,
    HealthModule,
  ],
})
export class AppModule {}
