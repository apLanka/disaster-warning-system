import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { RegisterCitizenInput } from '@repo/types';

import type { CitizenEntity } from './citizen.entity.js';
import { CITIZEN_DIRECTORY } from './citizen-directory.js';
import type { CitizenDirectory } from './citizen-directory.js';

/** A citizen's alert area: the district warnings are targeted by (finding UI5). */
@Injectable()
export class CitizensService {
  constructor(
    @Inject(CITIZEN_DIRECTORY) private readonly directory: CitizenDirectory,
  ) {}

  register(
    deviceId: string,
    input: RegisterCitizenInput,
  ): Promise<CitizenEntity> {
    return this.directory.register(deviceId, input.district, input.phone);
  }

  async profile(deviceId: string): Promise<CitizenEntity> {
    const citizen = await this.directory.findByDeviceId(deviceId);
    if (!citizen)
      throw new NotFoundException('Set your district to receive warnings');
    return citizen;
  }
}
