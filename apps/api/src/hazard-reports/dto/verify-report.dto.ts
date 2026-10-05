import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { HAZARD_REPORT_LIMITS, type VerifyReportInput } from '@repo/types';

import { trimToUndefined } from '../../common/transforms.js';

export class VerifyReportDto implements VerifyReportInput {
  @ApiPropertyOptional({
    description: 'Internal note, never shown to the reporter',
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(HAZARD_REPORT_LIMITS.notesMax)
  notes?: string;
}
