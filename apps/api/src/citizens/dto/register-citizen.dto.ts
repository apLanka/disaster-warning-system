import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, Matches } from 'class-validator';

import {
  DISTRICT_KEYS,
  normalizeSriLankanMobile,
  type District,
  type RegisterCitizenInput,
} from '@repo/types';

/** Blank means no phone; anything recognisable becomes +947XXXXXXXX. */
function toMobile({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return normalizeSriLankanMobile(value) ?? value;
}

export class RegisterCitizenDto implements RegisterCitizenInput {
  @ApiProperty({ enum: DISTRICT_KEYS })
  @IsIn(DISTRICT_KEYS)
  district: District;

  @ApiPropertyOptional({
    example: '077 123 4567',
    description: 'For SMS warnings',
  })
  @IsOptional()
  @Matches(/^\+947\d{8}$/, {
    message: 'phone must be a Sri Lankan mobile number, such as 077 123 4567',
  })
  @Transform(toMobile)
  phone?: string;
}
