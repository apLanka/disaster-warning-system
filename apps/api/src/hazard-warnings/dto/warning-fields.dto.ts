import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import {
  DISTRICTS,
  HAZARD_TYPES,
  WARNING_LEVELS,
  WARNING_LIMITS,
  type District,
  type HazardType,
  type WarningFields,
  type WarningLevel,
} from '@repo/types';

import {
  trimEachDroppingBlank,
  trimToUndefined,
} from '../../common/transforms.js';

const L = WARNING_LIMITS;

/**
 * What the officer fills in. Only type, level and districts are required here
 * so a draft can be saved half-done; the service checks the rest before issue.
 * Decorators run bottom-up and only the first failure per field is kept, so
 * the most basic check sits next to the property.
 */
export class WarningFieldsDto implements WarningFields {
  @ApiProperty({ enum: HAZARD_TYPES })
  @IsIn(HAZARD_TYPES)
  hazardType: HazardType;

  @ApiProperty({ enum: WARNING_LEVELS })
  @IsIn(WARNING_LEVELS)
  level: WarningLevel;

  @ApiProperty({ enum: DISTRICTS, isArray: true })
  @IsIn(DISTRICTS, { each: true })
  @ArrayUnique()
  @ArrayMaxSize(L.districtsMax)
  @ArrayMinSize(1, { message: 'select at least one affected district' })
  @IsArray()
  districts: District[];

  @ApiPropertyOptional({
    minLength: L.descriptionMin,
    maxLength: L.descriptionMax,
  })
  @IsOptional()
  @Length(L.descriptionMin, L.descriptionMax)
  @IsString()
  @Transform(trimToUndefined)
  description?: string;

  @ApiPropertyOptional({ maxLength: L.additionalInfoMax })
  @IsOptional()
  @MaxLength(L.additionalInfoMax)
  @IsString()
  @Transform(trimToUndefined)
  additionalInfo?: string;

  @ApiPropertyOptional({ type: [String], maxItems: L.instructionsMax })
  @IsOptional()
  @Length(L.instructionMin, L.instructionMax, { each: true })
  @IsString({ each: true })
  @ArrayMaxSize(L.instructionsMax)
  @IsArray()
  @Transform(trimEachDroppingBlank)
  safetyInstructions?: string[];

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  validFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  validUntil?: string;

  @ApiPropertyOptional({
    description: 'Verified hazard report this warning was started from',
  })
  @IsOptional()
  @IsMongoId()
  sourceReportId?: string;
}
