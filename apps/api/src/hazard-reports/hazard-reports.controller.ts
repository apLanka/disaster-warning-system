import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import {
  HAZARD_REPORT_LIMITS,
  type HazardReportDto,
  type Paginated,
  type ReportStats,
} from '@repo/types';

import type { Caller } from '../common/auth/caller.js';
import { CurrentCaller } from '../common/auth/current-caller.decorator.js';
import { OfficerGuard } from '../common/auth/officer.guard.js';
import { OfficerOrReporterGuard } from '../common/auth/officer-or-reporter.guard.js';
import { ReporterId } from '../common/decorators/reporter-id.decorator.js';
import type { PhotoUpload } from '../storage/photo-storage.js';
import {
  toHazardReportDto,
  toReporterReportDto,
} from './domain/hazard-report.mapper.js';
import { CreateHazardReportDto } from './dto/create-hazard-report.dto.js';
import { ListReportsQueryDto } from './dto/list-reports-query.dto.js';
import { RejectReportDto } from './dto/reject-report.dto.js';
import { VerifyReportDto } from './dto/verify-report.dto.js';
import { HazardReportsService } from './hazard-reports.service.js';
import { photoUploadOptions, ValidatePhotosPipe } from './photo-upload.js';

/**
 * Static routes (`mine`, `stats`) are declared before `:id` so the id
 * parameter can never swallow them.
 */
@ApiTags('hazard-reports')
@Controller('hazard-reports')
export class HazardReportsController {
  constructor(private readonly service: HazardReportsService) {}

  @Post()
  @ApiSecurity('reporter-id')
  @ApiOperation({
    summary: 'Submit a hazard report (201, or 200 for a replay)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateHazardReportDto })
  @UseInterceptors(
    FilesInterceptor(
      'photos',
      HAZARD_REPORT_LIMITS.photosMax,
      photoUploadOptions,
    ),
  )
  async submit(
    @ReporterId() reporterId: string,
    @Body() dto: CreateHazardReportDto,
    @UploadedFiles(new ValidatePhotosPipe()) files: PhotoUpload[],
    @Res({ passthrough: true }) response: Response,
  ): Promise<HazardReportDto> {
    const { report, created } = await this.service.submit(
      reporterId,
      dto,
      files,
    );
    response.status(created ? 201 : 200);
    return toReporterReportDto(report);
  }

  @Get('mine')
  @ApiSecurity('reporter-id')
  @ApiOperation({ summary: "List the caller's own reports, newest first" })
  async findMine(@ReporterId() reporterId: string): Promise<HazardReportDto[]> {
    const reports = await this.service.findMine(reporterId);
    return reports.map(toReporterReportDto);
  }

  @Get('stats')
  @UseGuards(OfficerGuard)
  @ApiSecurity('officer-key')
  @ApiOperation({
    summary: 'Officer: pending, verified today, rejected, total',
  })
  stats(): Promise<ReportStats> {
    return this.service.stats();
  }

  @Get()
  @UseGuards(OfficerGuard)
  @ApiSecurity('officer-key')
  @ApiOperation({ summary: 'Officer: filter, sort, and page through reports' })
  async list(
    @Query() query: ListReportsQueryDto,
  ): Promise<Paginated<HazardReportDto>> {
    const page = await this.service.list(query);
    return { ...page, items: page.items.map(toHazardReportDto) };
  }

  @Get(':id')
  @UseGuards(OfficerOrReporterGuard)
  @ApiSecurity('officer-key')
  @ApiSecurity('reporter-id')
  @ApiOperation({
    summary: 'One report: any for an officer, only their own for a reporter',
  })
  async findOne(
    @Param('id') id: string,
    @CurrentCaller() caller: Caller,
  ): Promise<HazardReportDto> {
    const report = await this.service.findOne(id, caller);
    return caller.kind === 'officer'
      ? toHazardReportDto(report)
      : toReporterReportDto(report);
  }

  @Patch(':id/verify')
  @UseGuards(OfficerGuard)
  @ApiSecurity('officer-key')
  @ApiOperation({
    summary: 'Officer: verify a pending report (409 if already decided)',
  })
  async verify(
    @Param('id') id: string,
    @Body() dto: VerifyReportDto,
    @CurrentCaller() caller: Caller,
  ): Promise<HazardReportDto> {
    const report = await this.service.verify(id, officerName(caller), dto);
    return toHazardReportDto(report);
  }

  @Patch(':id/reject')
  @UseGuards(OfficerGuard)
  @ApiSecurity('officer-key')
  @ApiOperation({
    summary:
      'Officer: reject a pending report with a reason (409 if already decided)',
  })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectReportDto,
    @CurrentCaller() caller: Caller,
  ): Promise<HazardReportDto> {
    const report = await this.service.reject(id, officerName(caller), dto);
    return toHazardReportDto(report);
  }
}

/** OfficerGuard guarantees an officer; this narrows the type for the compiler. */
function officerName(caller: Caller): string {
  if (caller.kind !== 'officer')
    throw new Error('Officer route reached by a non-officer');
  return caller.name;
}
