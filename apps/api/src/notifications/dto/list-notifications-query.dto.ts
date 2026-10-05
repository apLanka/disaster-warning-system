import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export const DEFAULT_NOTIFICATION_LIMIT = 50;
export const MAX_NOTIFICATION_LIMIT = 100;

/** Query strings arrive as text: only the exact words "true" and "false" count. */
function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Only notifications not yet read',
  })
  @Transform(toBoolean)
  @IsBoolean()
  unread = false;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_NOTIFICATION_LIMIT,
    default: DEFAULT_NOTIFICATION_LIMIT,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_NOTIFICATION_LIMIT)
  limit = DEFAULT_NOTIFICATION_LIMIT;
}
