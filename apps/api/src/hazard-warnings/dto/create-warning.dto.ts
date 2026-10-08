import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

import type { CreateWarningInput } from '@repo/types';

import { WarningFieldsDto } from './warning-fields.dto.js';

const ACTIONS = ['DRAFT', 'ISSUE'] as const;

export class CreateWarningDto
  extends WarningFieldsDto
  implements CreateWarningInput
{
  @ApiProperty({
    description:
      'Generated per form; a repeated request returns the first warning',
  })
  @IsUUID()
  clientRequestId: string;

  @ApiProperty({ enum: ACTIONS })
  @IsIn(ACTIONS)
  action: CreateWarningInput['action'];

  @ApiPropertyOptional({
    description:
      'Issue even if an active warning already covers this hazard and area',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
