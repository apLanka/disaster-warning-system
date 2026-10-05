import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  HAZARD_REPORT_LIMITS,
  HAZARD_TYPES,
  type HazardType,
  type ListReportsQuery,
  type ReportSort,
} from '@repo/types';

import type { StoredReportStatus } from '../domain/hazard-report.entity.js';

const STORED_STATUSES = [
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
] as const;
const SORTS = ['newest', 'oldest'] as const;
export const DEFAULT_PAGE_SIZE = 20;

export class ListReportsQueryDto implements ListReportsQuery {
  @ApiPropertyOptional({ enum: STORED_STATUSES })
  @IsOptional()
  @IsIn(STORED_STATUSES)
  status?: StoredReportStatus;

  @ApiPropertyOptional({ enum: HAZARD_TYPES })
  @IsOptional()
  @IsIn(HAZARD_TYPES)
  type?: HazardType;

  @ApiPropertyOptional({ enum: SORTS, default: 'newest' })
  @IsIn(SORTS)
  sort: ReportSort = 'newest';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: HAZARD_REPORT_LIMITS.pageSizeMax,
    default: DEFAULT_PAGE_SIZE,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(HAZARD_REPORT_LIMITS.pageSizeMax)
  limit = DEFAULT_PAGE_SIZE;
}
