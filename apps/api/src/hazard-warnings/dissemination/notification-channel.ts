import type { ChannelKind, District, MessageKind } from '@repo/types';

import type { Recipient } from '../../citizens/citizen-directory.js';

/** Injection token for the list of every channel a warning is sent on. */
export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

export interface ChannelMessage {
  warningId: string;
  kind: MessageKind;
  text: string;
  districts: District[];
}

export interface ChannelResult {
  /** Who this channel could reach. 0 means the channel is skipped. */
  recipients: number;
  delivered: number;
}

/**
 * One way of reaching citizens (Strategy). Adding a channel, such as radio,
 * means adding a class and listing it in the module; nothing else changes.
 * A failure is a thrown error, which the disseminator records.
 */
export interface NotificationChannel {
  readonly kind: ChannelKind;
  send(
    message: ChannelMessage,
    recipients: Recipient[],
  ): Promise<ChannelResult>;
}
