import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import type {
  DisasterEventDto,
  Paginated,
  PostDisasterReportDto,
} from '@repo/types';

import { OfficerGuard } from '../common/auth/officer.guard.js';
import { DisasterAnalysisService } from './disaster-analysis.service.js';
import { ListEventsQueryDto } from './dto/list-events-query.dto.js';
import { ReportQueryDto } from './dto/report-query.dto.js';

/** Read-only and officer-only: the events open to analysis, and their reports. */
@ApiTags('disaster-events')
@ApiSecurity('officer-key')
@UseGuards(OfficerGuard)
@Controller('disaster-events')
export class PostDisasterReportController {
  constructor(private readonly service: DisasterAnalysisService) {}

  @Get()
  @ApiOperation({
    summary: 'List completed disaster events available for analysis',
  })
  getAvailableEvents(
    @Query() query: ListEventsQueryDto,
  ): Promise<Paginated<DisasterEventDto>> {
    return this.service.listCompletedEvents(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One disaster event, for choosing the report scope',
  })
  getEvent(@Param('id') id: string): Promise<DisasterEventDto> {
    return this.service.getEvent(id);
  }

  @Get(':id/report')
  @ApiOperation({
    summary: 'Generate the post-disaster report, for all districts or one',
  })
  requestReport(
    @Param('id') id: string,
    @Query() query: ReportQueryDto,
  ): Promise<PostDisasterReportDto> {
    return this.service.generateDisasterReport(id, query.district);
  }
}
