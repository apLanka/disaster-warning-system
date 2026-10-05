import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { trim, trimToUndefined } from '../../common/transforms.js';

import {
  HAZARD_REPORT_LIMITS,
  HAZARD_TYPES,
  type CreateHazardReportFields,
  type HazardType,
} from '@repo/types';

const { descriptionMin, descriptionMax } = HAZARD_REPORT_LIMITS;

/** Text fields of the multipart submit request. Photos arrive as files. */
export class CreateHazardReportDto implements CreateHazardReportFields {
  @ApiProperty({
    description: 'Generated per draft; makes retries and offline replays safe',
  })
  @IsUUID()
  clientRequestId: string;

  @ApiProperty({ enum: HAZARD_TYPES })
  @IsIn(HAZARD_TYPES)
  type: HazardType;

  @ApiProperty({ minLength: descriptionMin, maxLength: descriptionMax })
  @Transform(trim)
  @IsString()
  @Length(descriptionMin, descriptionMax)
  description: string;

  @ApiProperty({ minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(100)
  reporterName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(50)
  reporterContact?: string;
}
