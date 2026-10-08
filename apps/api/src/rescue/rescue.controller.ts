import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type {
  ActiveDisasterEventSummary,
  AffectedDistrictInfo,
  DispatchValidationResult,
  EventResponseStatusSummary,
  RescueAssignment,
  RescueTeamItem,
} from '@repo/types';

import {
  CreateRescueAssignmentDto,
  UpdateMissionStatusDto,
  ValidateDispatchDto,
} from './dto/rescue.dto.js';
import { RescueService } from './rescue.service.js';

@ApiTags('Rescue Operations')
@Controller('rescue')
export class RescueController {
  constructor(private readonly rescueService: RescueService) {}

  @Get('events/active')
  @ApiOperation({ summary: 'List active disaster events for rescue dispatch' })
  async getActiveEvents(): Promise<ActiveDisasterEventSummary[]> {
    return this.rescueService.getActiveEvents();
  }

  @Get('events/:eventId/districts')
  @ApiOperation({ summary: 'Get affected districts for a disaster event' })
  async getEventDistricts(@Param('eventId') eventId: string): Promise<{
    event: ActiveDisasterEventSummary;
    districts: AffectedDistrictInfo[];
  }> {
    return this.rescueService.getEventDistricts(eventId);
  }

  @Get('events/:eventId/response-status')
  @ApiOperation({
    summary:
      'Get real-time synchronized event response & mission statuses (SQ8)',
  })
  async getResponseStatus(
    @Param('eventId') eventId: string,
  ): Promise<EventResponseStatusSummary> {
    return this.rescueService.getResponseStatus(eventId);
  }

  @Post('validate-dispatch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Validate disaster event, emergency location and deployment eligibility (SQ1)',
  })
  async validateDispatch(
    @Body() dto: ValidateDispatchDto,
  ): Promise<DispatchValidationResult> {
    return this.rescueService.validateDispatch(
      dto.disasterEventId,
      dto.districtCode,
      dto.rescueTeamId,
      dto.emergencyLocation,
    );
  }

  @Get('teams')
  @ApiOperation({
    summary: 'Get available rescue teams with optional district filtering',
  })
  @ApiQuery({ name: 'districtCode', required: false })
  @ApiQuery({ name: 'includeExternal', required: false, type: Boolean })
  async getRescueTeams(
    @Query('districtCode') districtCode?: string,
    @Query('includeExternal') includeExternal?: string,
  ): Promise<RescueTeamItem[]> {
    const isInclude = includeExternal === 'true' || includeExternal === '1';
    return this.rescueService.getRescueTeams(districtCode, isInclude);
  }

  @Post('assignments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Atomically assign an available rescue team (SQ2 & SQ7)',
  })
  async createAssignment(
    @Body() dto: CreateRescueAssignmentDto,
  ): Promise<RescueAssignment> {
    return this.rescueService.createAssignmentAtomically(dto);
  }

  @Get('missions/:id')
  @ApiOperation({ summary: 'Get assigned rescue mission details' })
  async getMission(@Param('id') id: string): Promise<RescueAssignment> {
    return this.rescueService.getMission(id);
  }

  @Get('portal/missions')
  @ApiOperation({
    summary: 'Rescue Team Portal: List all assigned missions for leader (SQ4)',
  })
  async getLeaderMissions(
    @Headers('x-leader-id') leaderId?: string,
  ): Promise<RescueAssignment[]> {
    return this.rescueService.getLeaderMissions(leaderId);
  }

  @Get('portal/missions/:id')
  @ApiOperation({
    summary: 'Rescue Team Portal: View assigned mission details (SQ4)',
  })
  async viewAssignedMission(
    @Param('id') id: string,
    @Headers('x-leader-id') leaderId?: string,
  ): Promise<RescueAssignment> {
    return this.rescueService.viewAssignedMission(id, leaderId);
  }

  @Patch('missions/:id/status')
  @ApiOperation({
    summary: 'Update rescue mission status with lifecycle validation (SQ5)',
  })
  async updateMissionStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMissionStatusDto,
  ): Promise<RescueAssignment> {
    return this.rescueService.updateMissionStatus(id, dto);
  }
}
