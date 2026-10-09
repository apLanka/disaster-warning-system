import { Injectable, Logger } from '@nestjs/common';

import type { Recipient } from '../../citizens/citizen-directory.js';
import { ChannelFailureSwitch } from './channel-failure-switch.js';
import type {
  ChannelMessage,
  ChannelResult,
  NotificationChannel,
} from './notification-channel.js';

/** Simulated SMS gateway: accepts every message unless switched off. */
@Injectable()
export class SmsChannel implements NotificationChannel {
  readonly kind = 'SMS' as const;
  private readonly logger = new Logger(SmsChannel.name);

  constructor(private readonly failures: ChannelFailureSwitch) {}

  async send(
    message: ChannelMessage,
    recipients: Recipient[],
  ): Promise<ChannelResult> {
    this.failures.check(this.kind);
    const reachable = recipients.filter(
      (recipient) => recipient.phone !== undefined,
    );
    this.logger.log(
      `Simulated SMS to ${reachable.length} phones: ${message.text}`,
    );
    return { recipients: reachable.length, delivered: reachable.length };
  }
}
