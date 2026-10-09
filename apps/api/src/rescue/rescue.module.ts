import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { RescueController } from './rescue.controller.js';
import { RescueService } from './rescue.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [RescueController],
  providers: [RescueService],
  exports: [RescueService],
})
export class RescueModule {}
