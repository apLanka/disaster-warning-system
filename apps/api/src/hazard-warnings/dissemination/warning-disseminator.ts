import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  CHANNEL_LABELS,
  type ChannelKind,
  type MessageKind,
} from '@repo/types';

import { CITIZEN_DIRECTORY } from '../../citizens/citizen-directory.js';
import type {
  CitizenDirectory,
  Recipient,
} from '../../citizens/citizen-directory.js';
import type {
  DisseminationChannelState,
  HazardWarningEntity,
} from '../domain/hazard-warning.entity.js';
import { allClearMessage, warningMessage } from '../domain/warning-rules.js';
import { NOTIFICATION_LOG_REPOSITORY } from '../notification-log.repository.js';
import type {
  NewNotificationLog,
  NotificationLogRepository,
} from '../notification-log.repository.js';
import { NOTIFICATION_CHANNELS } from './notification-channel.js';
import type {
  ChannelMessage,
  ChannelResult,
  NotificationChannel,
} from './notification-channel.js';

export const DIRECTORY_UNAVAILABLE =
  'Notification service is temporarily unavailable.';

const SENT_TEXT: Record<ChannelKind, (count: number) => string> = {
  PUSH: (count) => `Push notification delivered to ${count} citizens`,
  SMS: (count) => `SMS gateway confirmed ${count} deliveries`,
  AUDIBLE: (count) =>
    `Audible alert network activated across ${count} districts`,
};

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** One line for Live Delivery Activity. */
function describeOutcome(
  kind: ChannelKind,
  outcome: PromiseSettledResult<ChannelResult>,
): string {
  if (outcome.status === 'rejected')
    return `${CHANNEL_LABELS[kind]} failed: ${errorText(outcome.reason)}`;
  if (outcome.value.recipients === 0)
    return `${CHANNEL_LABELS[kind]}: nobody to reach in the selected area`;
  return SENT_TEXT[kind](outcome.value.delivered);
}

/**
 * Sends a warning on several channels at once and turns every outcome into a
 * recorded channel state. It never throws: a failure is data the officer acts
 * on (Retry), not an error that would lose the stored warning.
 */
@Injectable()
export class WarningDisseminator {
  private readonly logger = new Logger(WarningDisseminator.name);

  constructor(
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: NotificationChannel[],
    @Inject(CITIZEN_DIRECTORY) private readonly citizens: CitizenDirectory,
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly logs: NotificationLogRepository,
  ) {}

  async send(
    warning: HazardWarningEntity,
    kinds: readonly ChannelKind[],
    now = new Date(),
  ): Promise<DisseminationChannelState[]> {
    const selected = this.channels.filter((channel) =>
      kinds.includes(channel.kind),
    );
    const attempts = (kind: ChannelKind) =>
      (warning.channels.find((item) => item.channel === kind)?.attempts ?? 0) +
      1;

    const message = this.message(warning, 'WARNING');
    const recipients = await this.recipients(warning);
    const outcomes = recipients
      ? await Promise.allSettled(
          selected.map((channel) => channel.send(message, recipients)),
        )
      : selected.map((): PromiseSettledResult<ChannelResult> => ({
          status: 'rejected',
          reason: new Error(DIRECTORY_UNAVAILABLE),
        }));

    return Promise.all(
      selected.map(async (channel, index) => {
        const outcome = outcomes[index]!;
        await this.log(warning.id, channel.kind, 'WARNING', outcome);
        return this.toState(channel.kind, outcome, attempts(channel.kind), now);
      }),
    );
  }

  /** Tells the same districts the warning is over. Best effort: outcomes are logged only. */
  async announceAllClear(warning: HazardWarningEntity): Promise<void> {
    const recipients = await this.recipients(warning);
    if (!recipients) return;

    const message = this.message(warning, 'ALL_CLEAR');
    const outcomes = await Promise.allSettled(
      this.channels.map((channel) => channel.send(message, recipients)),
    );
    await Promise.all(
      this.channels.map((channel, index) =>
        this.log(warning.id, channel.kind, 'ALL_CLEAR', outcomes[index]!),
      ),
    );
  }

  private message(
    warning: HazardWarningEntity,
    kind: MessageKind,
  ): ChannelMessage {
    return {
      warningId: warning.id,
      kind,
      text:
        kind === 'WARNING' ? warningMessage(warning) : allClearMessage(warning),
      districts: warning.districts,
    };
  }

  /** Null when the directory cannot be reached: every channel then fails. */
  private async recipients(
    warning: HazardWarningEntity,
  ): Promise<Recipient[] | null> {
    try {
      return await this.citizens.findInDistricts(warning.districts);
    } catch (error) {
      this.logger.error(
        `Could not load recipients for ${warning.reference}: ${errorText(error)}`,
      );
      return null;
    }
  }

  private toState(
    kind: ChannelKind,
    outcome: PromiseSettledResult<ChannelResult>,
    attempts: number,
    now: Date,
  ): DisseminationChannelState {
    if (outcome.status === 'rejected') {
      return {
        channel: kind,
        state: 'FAILED',
        recipients: 0,
        delivered: 0,
        attempts,
        lastError: errorText(outcome.reason),
      };
    }
    const { recipients, delivered } = outcome.value;
    if (recipients === 0) {
      return {
        channel: kind,
        state: 'SKIPPED',
        recipients,
        delivered,
        attempts,
      };
    }
    return {
      channel: kind,
      state: 'SENT',
      recipients,
      delivered,
      attempts,
      sentAt: now,
    };
  }

  /** A lost log line must never undo a delivery that already happened. */
  private async log(
    warningId: string,
    channel: ChannelKind,
    kind: MessageKind,
    outcome: PromiseSettledResult<ChannelResult>,
  ): Promise<void> {
    const text = describeOutcome(channel, outcome);
    const entry: NewNotificationLog = {
      warningId,
      channel,
      kind,
      outcome: outcome.status === 'fulfilled' ? 'SENT' : 'FAILED',
      message: kind === 'ALL_CLEAR' ? `All Clear: ${text}` : text,
      recipients: outcome.status === 'fulfilled' ? outcome.value.recipients : 0,
    };
    try {
      await this.logs.record(entry);
    } catch (error) {
      this.logger.warn(
        `Could not write the delivery log for ${warningId}: ${errorText(error)}`,
      );
    }
  }
}
