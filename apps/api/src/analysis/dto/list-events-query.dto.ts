import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  ANALYSIS_LIMITS,
  DISTRICT_CODES,
  HAZARD_TYPES,
  type DistrictCode,
  type HazardType,
  type ListEventsQuery,
} from '@repo/types';

import { trimToUndefined } from '../../common/transforms.js';

export class ListEventsQueryDto implements ListEventsQuery {
  @ApiPropertyOptional({ description: 'Matches the event name or reference' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: HAZARD_TYPES })
  @IsOptional()
  @IsIn(HAZARD_TYPES)
  hazardType?: HazardType;

  @ApiPropertyOptional({ enum: DISTRICT_CODES })
  @IsOptional()
  @IsIn(DISTRICT_CODES)
  district?: DistrictCode;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: ANALYSIS_LIMITS.pageSizeMax,
    default: ANALYSIS_LIMITS.pageSizeDefault,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ANALYSIS_LIMITS.pageSizeMax)
  limit: number = ANALYSIS_LIMITS.pageSizeDefault;
}
