import { Injectable, Logger } from '@nestjs/common';

import { ChannelFailureSwitch } from './channel-failure-switch.js';
import type {
  ChannelMessage,
  ChannelResult,
  NotificationChannel,
} from './notification-channel.js';

/** Simulated siren network: one activation per affected district. */
@Injectable()
export class AudibleAlertChannel implements NotificationChannel {
  readonly kind = 'AUDIBLE' as const;
  private readonly logger = new Logger(AudibleAlertChannel.name);

  constructor(private readonly failures: ChannelFailureSwitch) {}

  async send(message: ChannelMessage): Promise<ChannelResult> {
    this.failures.check(this.kind);
    this.logger.log(`Simulated sirens in ${message.districts.join(', ')}`);
    return {
      recipients: message.districts.length,
      delivered: message.districts.length,
    };
  }
}
