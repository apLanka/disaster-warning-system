import { Inject, Injectable } from '@nestjs/common';

import { ALERT_DELIVERY_REPOSITORY } from '../../citizens/alert-delivery.repository.js';
import type { AlertDeliveryRepository } from '../../citizens/alert-delivery.repository.js';
import type { Recipient } from '../../citizens/citizen-directory.js';
import { ChannelFailureSwitch } from './channel-failure-switch.js';
import type {
  ChannelMessage,
  ChannelResult,
  NotificationChannel,
} from './notification-channel.js';

/** The real channel: a delivery row per device, which the citizen app polls. */
@Injectable()
export class InAppPushChannel implements NotificationChannel {
  readonly kind = 'PUSH' as const;

  constructor(
    @Inject(ALERT_DELIVERY_REPOSITORY)
    private readonly deliveries: AlertDeliveryRepository,
    private readonly failures: ChannelFailureSwitch,
  ) {}

  async send(
    message: ChannelMessage,
    recipients: Recipient[],
  ): Promise<ChannelResult> {
    this.failures.check(this.kind);
    if (message.kind === 'ALL_CLEAR') {
      // The phones that hold the warning see it cancelled on their next check.
      return { recipients: recipients.length, delivered: recipients.length };
    }
    const delivered = await this.deliveries.recordDelivered(
      message.warningId,
      recipients.map((recipient) => recipient.deviceId),
    );
    return { recipients: recipients.length, delivered };
  }
}
