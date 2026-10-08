import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import type { CitizenProfileDto } from '@repo/types';

import { ReporterId } from '../common/decorators/reporter-id.decorator.js';
import { toCitizenProfileDto } from './citizen.mapper.js';
import { CitizensService } from './citizens.service.js';
import { RegisterCitizenDto } from './dto/register-citizen.dto.js';

@ApiTags('citizens')
@ApiSecurity('reporter-id')
@Controller('citizens')
export class CitizensController {
  constructor(private readonly service: CitizensService) {}

  @Put('me')
  @ApiOperation({
    summary: "Set the caller's alert district and optional SMS number",
  })
  async register(
    @ReporterId() deviceId: string,
    @Body() dto: RegisterCitizenDto,
  ): Promise<CitizenProfileDto> {
    return toCitizenProfileDto(await this.service.register(deviceId, dto));
  }

  @Get('me')
  @ApiOperation({ summary: "The caller's alert district (404 until set)" })
  async profile(@ReporterId() deviceId: string): Promise<CitizenProfileDto> {
    return toCitizenProfileDto(await this.service.profile(deviceId));
  }
}
