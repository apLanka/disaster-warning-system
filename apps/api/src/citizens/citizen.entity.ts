import type { District } from '@repo/types';

export interface CitizenEntity {
  id: string;
  deviceId: string;
  district: District;
  phone?: string;
  updatedAt: Date;
}

/** One warning delivered in-app to one device. */
export interface AlertDeliveryEntity {
  id: string;
  warningId: string;
  deviceId: string;
  deliveredAt: Date;
  acknowledgedAt?: Date;
}
