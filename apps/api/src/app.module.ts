import { Module } from '@nestjs/common';

import { AppConfigModule } from './config/app-config.module.js';
import { HazardReportsModule } from './hazard-reports/hazard-reports.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [AppConfigModule, PrismaModule, HazardReportsModule, HealthModule],
})
export class AppModule {}
