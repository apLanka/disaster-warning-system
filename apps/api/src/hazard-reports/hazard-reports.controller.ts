import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { HAZARD_REPORT_LIMITS, type HazardReportDto } from '@repo/types';

import { ReporterId } from '../common/decorators/reporter-id.decorator.js';
import type { PhotoUpload } from '../storage/photo-storage.js';
import { toHazardReportDto } from './domain/hazard-report.mapper.js';
import { CreateHazardReportDto } from './dto/create-hazard-report.dto.js';
import { HazardReportsService } from './hazard-reports.service.js';
import { photoUploadOptions, ValidatePhotosPipe } from './photo-upload.js';

@ApiTags('hazard-reports')
@ApiSecurity('reporter-id')
@ApiHeader({ name: 'x-reporter-id', description: 'Device-generated UUID' })
@Controller('hazard-reports')
export class HazardReportsController {
  constructor(private readonly service: HazardReportsService) {}

  @Post()
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
    return toHazardReportDto(report);
  }

  @Get('mine')
  @ApiOperation({ summary: "List the caller's own reports, newest first" })
  async findMine(@ReporterId() reporterId: string): Promise<HazardReportDto[]> {
    const reports = await this.service.findMine(reporterId);
    return reports.map(toHazardReportDto);
  }
}
