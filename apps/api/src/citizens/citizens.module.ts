import { Module } from '@nestjs/common';

import { ALERT_DELIVERY_REPOSITORY } from './alert-delivery.repository.js';
import { CITIZEN_DIRECTORY } from './citizen-directory.js';
import { CitizensController } from './citizens.controller.js';
import { CitizensService } from './citizens.service.js';
import { PrismaAlertDeliveryRepository } from './infrastructure/prisma-alert-delivery.repository.js';
import { PrismaCitizenDirectory } from './infrastructure/prisma-citizen-directory.js';

@Module({
  controllers: [CitizensController],
  providers: [
    CitizensService,
    { provide: CITIZEN_DIRECTORY, useClass: PrismaCitizenDirectory },
    {
      provide: ALERT_DELIVERY_REPOSITORY,
      useClass: PrismaAlertDeliveryRepository,
    },
  ],
  exports: [CITIZEN_DIRECTORY, ALERT_DELIVERY_REPOSITORY],
})
export class CitizensModule {}
