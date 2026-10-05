import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import {
  HAZARD_REPORT_LIMITS,
  REJECTION_REASONS,
  type RejectionReason,
  type RejectReportInput,
} from '@repo/types';

import { trimToUndefined } from '../../common/transforms.js';

export class RejectReportDto implements RejectReportInput {
  @ApiProperty({ enum: REJECTION_REASONS })
  @IsIn(REJECTION_REASONS)
  reason: RejectionReason;

  @ApiPropertyOptional({
    description: 'Shown to the reporter. Required when the reason is OTHER',
  })
  // Decorators run bottom-up and the pipe keeps only the first failure per field,
  // so the most helpful message ("required") goes last, next to the property.
  @MaxLength(HAZARD_REPORT_LIMITS.notesMax)
  @IsString()
  @IsNotEmpty({ message: 'details is required when reason is OTHER' })
  @Transform(trimToUndefined)
  @ValidateIf(
    (dto: RejectReportDto) =>
      dto.reason === 'OTHER' || dto.details !== undefined,
  )
  details?: string;

  @ApiPropertyOptional({
    description: 'Internal note, never shown to the reporter',
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(HAZARD_REPORT_LIMITS.notesMax)
  notes?: string;
}
