import type { District } from '@repo/types';

import type { CitizenEntity } from './citizen.entity.js';

export const CITIZEN_DIRECTORY = Symbol('CITIZEN_DIRECTORY');

/** Who to reach: the device and, when given, an SMS number. */
export interface Recipient {
  deviceId: string;
  district: District;
  phone?: string;
}

export interface RecipientCount {
  total: number;
  withPhone: number;
  byDistrict: Partial<Record<District, number>>;
}

/** Everything the services need to know about registered citizens, with no database types leaking out. */
export interface CitizenDirectory {
  register(
    deviceId: string,
    district: District,
    phone?: string,
  ): Promise<CitizenEntity>;
  findByDeviceId(deviceId: string): Promise<CitizenEntity | null>;
  findInDistricts(districts: District[]): Promise<Recipient[]>;
  countInDistricts(districts: District[]): Promise<RecipientCount>;
}
