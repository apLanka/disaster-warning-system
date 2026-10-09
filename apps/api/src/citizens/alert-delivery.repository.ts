import type { AlertDeliveryEntity } from './citizen.entity.js';

export const ALERT_DELIVERY_REPOSITORY = Symbol('ALERT_DELIVERY_REPOSITORY');

/** In-app deliveries of warnings to devices, with no database types leaking out. */
export interface AlertDeliveryRepository {
  /** Idempotent. Returns how many distinct devices now hold the warning. */
  recordDelivered(warningId: string, deviceIds: string[]): Promise<number>;
  listForDevice(
    deviceId: string,
    limit: number,
  ): Promise<AlertDeliveryEntity[]>;
  /** Sets acknowledgedAt once; null when nothing was delivered to this device. */
  acknowledge(
    warningId: string,
    deviceId: string,
    at: Date,
  ): Promise<AlertDeliveryEntity | null>;
  countAcknowledged(warningId: string): Promise<number>;
}
