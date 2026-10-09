import type { CitizenProfileDto } from '@repo/types';

import type { CitizenEntity } from './citizen.entity.js';

export function toCitizenProfileDto(citizen: CitizenEntity): CitizenProfileDto {
  return {
    district: citizen.district,
    phone: citizen.phone,
    updatedAt: citizen.updatedAt.toISOString(),
  };
}
