import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

import { DISTRICT_CODES, type DistrictCode } from '@repo/types';

import { trimToUndefined } from '../../common/transforms.js';

export class ReportQueryDto {
  @ApiPropertyOptional({
    enum: DISTRICT_CODES,
    description:
      'Limit the report to one district; omit for all affected districts',
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(DISTRICT_CODES)
  district?: DistrictCode;
}
