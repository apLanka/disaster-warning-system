import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

import {
  WARNING_LIMITS,
  type CancelWarningInput,
  type IssueWarningInput,
  type ListWarningsQuery,
  type WarningView,
} from '@repo/types';

import { trim } from '../../common/transforms.js';

const VIEWS = ['active', 'drafts', 'past'] as const;
export const DEFAULT_PAGE_SIZE = 20;

export class IssueWarningDto implements IssueWarningInput {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class CancelWarningDto implements CancelWarningInput {
  @ApiProperty({
    minLength: WARNING_LIMITS.cancelReasonMin,
    maxLength: WARNING_LIMITS.cancelReasonMax,
  })
  @Length(WARNING_LIMITS.cancelReasonMin, WARNING_LIMITS.cancelReasonMax)
  @IsString()
  @Transform(trim)
  reason: string;
}

export class ListWarningsQueryDto implements ListWarningsQuery {
  @ApiPropertyOptional({ enum: VIEWS, default: 'active' })
  @IsIn(VIEWS)
  view: WarningView = 'active';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: WARNING_LIMITS.pageSizeMax,
    default: DEFAULT_PAGE_SIZE,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(WARNING_LIMITS.pageSizeMax)
  limit = DEFAULT_PAGE_SIZE;
}

export class PrefillQueryDto {
  @ApiProperty()
  @IsMongoId()
  reportId: string;
}
