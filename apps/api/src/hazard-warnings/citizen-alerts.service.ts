import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { CitizenAlertDto } from '@repo/types';

import { ALERT_DELIVERY_REPOSITORY } from '../citizens/alert-delivery.repository.js';
import type { AlertDeliveryRepository } from '../citizens/alert-delivery.repository.js';
import { toCitizenAlertDto } from './domain/hazard-warning.mapper.js';
import { citizenAlertState } from './domain/warning-rules.js';
import { HAZARD_WARNING_REPOSITORY } from './hazard-warning.repository.js';
import type { HazardWarningRepository } from './hazard-warning.repository.js';

const DELIVERIES_READ = 50;

/** The citizen side of a warning: what reached this phone, and acknowledging it. */
@Injectable()
export class CitizenAlertsService {
  constructor(
    @Inject(ALERT_DELIVERY_REPOSITORY)
    private readonly deliveries: AlertDeliveryRepository,
    @Inject(HAZARD_WARNING_REPOSITORY)
    private readonly warnings: HazardWarningRepository,
  ) {}

  /** Active warnings first, then recent All Clears and expiries, newest first within each. */
  async listMine(
    deviceId: string,
    now = new Date(),
  ): Promise<CitizenAlertDto[]> {
    const received = await this.deliveries.listForDevice(
      deviceId,
      DELIVERIES_READ,
    );
    if (received.length === 0) return [];

    const warnings = await this.warnings.findByIds(
      received.map((item) => item.warningId),
    );
    const byId = new Map(warnings.map((warning) => [warning.id, warning]));

    const alerts = received.flatMap((item) => {
      const warning = byId.get(item.warningId);
      const state = warning && citizenAlertState(warning, now);
      return warning && state ? [toCitizenAlertDto(warning, item, state)] : [];
    });

    return alerts.sort((a, b) => {
      const rank = Number(a.state !== 'ACTIVE') - Number(b.state !== 'ACTIVE');
      return rank !== 0 ? rank : b.issuedAt.localeCompare(a.issuedAt);
    });
  }

  async acknowledge(
    warningId: string,
    deviceId: string,
    now = new Date(),
  ): Promise<CitizenAlertDto> {
    const warning = await this.warnings.findById(warningId);
    const state = warning && citizenAlertState(warning, now);
    if (!warning || !state) throw new NotFoundException('Alert not found');
    if (state !== 'ACTIVE')
      throw new ConflictException('This warning is no longer active');

    const delivery = await this.deliveries.acknowledge(
      warningId,
      deviceId,
      now,
    );
    if (!delivery) throw new NotFoundException('Alert not found');
    return toCitizenAlertDto(warning, delivery, state);
  }
}
