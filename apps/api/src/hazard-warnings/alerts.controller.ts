import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import type { CitizenAlertDto } from '@repo/types';

import { ReporterId } from '../common/decorators/reporter-id.decorator.js';
import { CitizenAlertsService } from './citizen-alerts.service.js';

@ApiTags('alerts')
@ApiSecurity('reporter-id')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: CitizenAlertsService) {}

  @Get('mine')
  @ApiOperation({
    summary:
      'Warnings delivered to this device: active first, then recent All Clears',
  })
  listMine(@ReporterId() deviceId: string): Promise<CitizenAlertDto[]> {
    return this.service.listMine(deviceId);
  }

  @Post(':warningId/acknowledge')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mark an active warning as acknowledged (idempotent)',
  })
  acknowledge(
    @ReporterId() deviceId: string,
    @Param('warningId') warningId: string,
  ): Promise<CitizenAlertDto> {
    return this.service.acknowledge(warningId, deviceId);
  }
}
