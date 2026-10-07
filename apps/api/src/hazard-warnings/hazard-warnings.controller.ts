import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import type {
  HazardWarningDetailDto,
  HazardWarningDto,
  Paginated,
  WarningPrefill,
  WarningPreview,
  WarningStats,
} from '@repo/types';

import { officerNameOf, type Caller } from '../common/auth/caller.js';
import { CurrentCaller } from '../common/auth/current-caller.decorator.js';
import { OfficerGuard } from '../common/auth/officer.guard.js';
import {
  toHazardWarningDetailDto,
  toHazardWarningDto,
} from './domain/hazard-warning.mapper.js';
import { CreateWarningDto } from './dto/create-warning.dto.js';
import {
  CancelWarningDto,
  IssueWarningDto,
  ListWarningsQueryDto,
  PrefillQueryDto,
} from './dto/warning-action.dtos.js';
import { WarningFieldsDto } from './dto/warning-fields.dto.js';
import { HazardWarningsService } from './hazard-warnings.service.js';
import { WarningQueriesService } from './warning-queries.service.js';

/** Officer routes. Static paths come before `:id` so the parameter never swallows them. */
@ApiTags('hazard-warnings')
@ApiSecurity('officer-key')
@UseGuards(OfficerGuard)
@Controller('hazard-warnings')
export class HazardWarningsController {
  constructor(
    private readonly commands: HazardWarningsService,
    private readonly queries: WarningQueriesService,
  ) {}

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Validate, count recipients and find duplicates. Stores nothing.',
  })
  async preview(@Body() dto: WarningFieldsDto): Promise<WarningPreview> {
    const now = new Date();
    const { recipients, duplicates } = await this.commands.preview(dto, now);
    return {
      recipients,
      duplicates: duplicates.map((warning) => toHazardWarningDto(warning, now)),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Active, drafts, issued today' })
  stats(): Promise<WarningStats> {
    return this.queries.stats();
  }

  @Get('prefill')
  @ApiOperation({ summary: 'Form values from a VERIFIED hazard report' })
  prefill(@Query() query: PrefillQueryDto): Promise<WarningPrefill> {
    return this.queries.prefill(query.reportId);
  }

  @Get()
  @ApiOperation({ summary: 'Active, draft or past warnings, newest first' })
  async list(
    @Query() query: ListWarningsQueryDto,
  ): Promise<Paginated<HazardWarningDto>> {
    const now = new Date();
    const page = await this.queries.list(
      query.view,
      query.page,
      query.limit,
      now,
    );
    return {
      ...page,
      items: page.items.map((warning) => toHazardWarningDto(warning, now)),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One warning with channel status and delivery activity',
  })
  async findOne(@Param('id') id: string): Promise<HazardWarningDetailDto> {
    const { warning, logs, acknowledged } = await this.queries.findOne(id);
    return toHazardWarningDetailDto(warning, logs, acknowledged, new Date());
  }

  @Post()
  @ApiOperation({
    summary: 'Save a draft or issue now (201, or 200 for a replay)',
  })
  async create(
    @Body() dto: CreateWarningDto,
    @CurrentCaller() caller: Caller,
    @Res({ passthrough: true }) response: Response,
  ): Promise<HazardWarningDto> {
    const { warning, created } = await this.commands.create(
      dto,
      officerNameOf(caller),
    );
    response.status(created ? 201 : 200);
    return toHazardWarningDto(warning, new Date());
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a draft (409 if it was issued)' })
  async update(
    @Param('id') id: string,
    @Body() dto: WarningFieldsDto,
  ): Promise<HazardWarningDto> {
    return toHazardWarningDto(
      await this.commands.updateDraft(id, dto),
      new Date(),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a draft' })
  remove(@Param('id') id: string): Promise<void> {
    return this.commands.deleteDraft(id);
  }

  @Post(':id/issue')
  @HttpCode(200)
  @ApiOperation({ summary: 'Issue a draft and send it' })
  async issue(
    @Param('id') id: string,
    @Body() dto: IssueWarningDto,
    @CurrentCaller() caller: Caller,
  ): Promise<HazardWarningDto> {
    const warning = await this.commands.issue(
      id,
      officerNameOf(caller),
      dto.force ?? false,
    );
    return toHazardWarningDto(warning, new Date());
  }

  @Post(':id/retry')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send again on the channels that failed' })
  async retry(@Param('id') id: string): Promise<HazardWarningDto> {
    return toHazardWarningDto(await this.commands.retry(id), new Date());
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel an issued warning and send an All Clear' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelWarningDto,
    @CurrentCaller() caller: Caller,
  ): Promise<HazardWarningDto> {
    const warning = await this.commands.cancel(
      id,
      officerNameOf(caller),
      dto.reason,
    );
    return toHazardWarningDto(warning, new Date());
  }
}
