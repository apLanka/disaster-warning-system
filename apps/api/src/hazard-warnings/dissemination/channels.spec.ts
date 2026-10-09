import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import {
  DEVICE_ID,
  fakeDeliveries,
  OTHER_DEVICE_ID,
  WARNING_ID,
} from '../testing/fixtures.js';
import { AudibleAlertChannel } from './audible-alert.channel.js';
import {
  ChannelFailureSwitch,
  ChannelUnavailableError,
} from './channel-failure-switch.js';
import { InAppPushChannel } from './in-app-push.channel.js';
import type {
  ChannelMessage,
  NotificationChannel,
} from './notification-channel.js';
import { SmsChannel } from './sms.channel.js';

function failures(...kinds: string[]) {
  const config = { get: () => kinds } as unknown as ConfigService<Env, true>;
  return new ChannelFailureSwitch(config);
}

const warning: ChannelMessage = {
  warningId: WARNING_ID,
  kind: 'WARNING',
  text: 'HIGH Flood warning',
  districts: ['COLOMBO', 'GAMPAHA'],
};
const recipients = [
  { deviceId: DEVICE_ID, district: 'COLOMBO' as const, phone: '+94771234567' },
  { deviceId: OTHER_DEVICE_ID, district: 'GAMPAHA' as const },
];

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChannelFailureSwitch', () => {
  it('throws only for the configured channels', () => {
    const toggle = failures('SMS');
    expect(() => toggle.check('PUSH')).not.toThrow();
    expect(() => toggle.check('SMS')).toThrow(
      new ChannelUnavailableError('SMS'),
    );
    expect(() => toggle.check('SMS')).toThrow('SMS gateway is unavailable');
  });
});

describe('InAppPushChannel', () => {
  it('records a delivery for every recipient device', async () => {
    const deliveries = fakeDeliveries();
    const channel = new InAppPushChannel(deliveries, failures());

    await expect(channel.send(warning, recipients)).resolves.toEqual({
      recipients: 2,
      delivered: 2,
    });
    expect(deliveries.recordDelivered).toHaveBeenCalledWith(WARNING_ID, [
      DEVICE_ID,
      OTHER_DEVICE_ID,
    ]);
  });

  it('writes nothing for an All Clear: phones see the cancellation on their next check', async () => {
    const deliveries = fakeDeliveries();
    const channel = new InAppPushChannel(deliveries, failures());

    await expect(
      channel.send({ ...warning, kind: 'ALL_CLEAR' }, recipients),
    ).resolves.toEqual({ recipients: 2, delivered: 2 });
    expect(deliveries.recordDelivered).not.toHaveBeenCalled();
  });

  it('fails when its gateway is switched off', async () => {
    const channel = new InAppPushChannel(fakeDeliveries(), failures('PUSH'));
    await expect(channel.send(warning, recipients)).rejects.toThrow(
      'Push Notification gateway is unavailable',
    );
  });
});

describe('SmsChannel', () => {
  it('texts only the recipients who gave a phone number', async () => {
    const channel = new SmsChannel(failures());
    await expect(channel.send(warning, recipients)).resolves.toEqual({
      recipients: 1,
      delivered: 1,
    });
  });

  it('reaches nobody when no recipient has a phone', async () => {
    const channel = new SmsChannel(failures());
    await expect(channel.send(warning, [recipients[1]!])).resolves.toEqual({
      recipients: 0,
      delivered: 0,
    });
  });

  it('fails when its gateway is switched off', async () => {
    await expect(
      new SmsChannel(failures('SMS')).send(warning, recipients),
    ).rejects.toThrow(ChannelUnavailableError);
  });
});

describe('AudibleAlertChannel', () => {
  it('sounds one siren network per district, whoever is registered', async () => {
    const channel: NotificationChannel = new AudibleAlertChannel(failures());
    await expect(channel.send(warning, [])).resolves.toEqual({
      recipients: 2,
      delivered: 2,
    });
  });

  it('fails when its gateway is switched off', async () => {
    const channel: NotificationChannel = new AudibleAlertChannel(
      failures('AUDIBLE'),
    );
    await expect(channel.send(warning, [])).rejects.toThrow(
      ChannelUnavailableError,
    );
  });
});
