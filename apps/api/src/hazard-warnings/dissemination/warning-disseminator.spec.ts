import { Logger } from '@nestjs/common';

import type { ChannelKind } from '@repo/types';

import {
  channel,
  DEVICE_ID,
  fakeDirectory,
  fakeLogRepository,
  issuedWarning,
  NOW,
  WARNING_ID,
} from '../testing/fixtures.js';
import type { NotificationChannel } from './notification-channel.js';
import {
  DIRECTORY_UNAVAILABLE,
  WarningDisseminator,
} from './warning-disseminator.js';

function fakeChannel(kind: ChannelKind, recipients = 2) {
  return {
    kind,
    send: vi
      .fn<NotificationChannel['send']>()
      .mockResolvedValue({ recipients, delivered: recipients }),
  };
}

describe('WarningDisseminator', () => {
  let push: ReturnType<typeof fakeChannel>;
  let sms: ReturnType<typeof fakeChannel>;
  let audible: ReturnType<typeof fakeChannel>;
  let directory: ReturnType<typeof fakeDirectory>;
  let logs: ReturnType<typeof fakeLogRepository>;
  let disseminator: WarningDisseminator;

  beforeEach(() => {
    push = fakeChannel('PUSH');
    sms = fakeChannel('SMS', 0);
    audible = fakeChannel('AUDIBLE');
    directory = fakeDirectory();
    directory.findInDistricts.mockResolvedValue([
      { deviceId: DEVICE_ID, district: 'COLOMBO' },
    ]);
    logs = fakeLogRepository();
    disseminator = new WarningDisseminator(
      [push, sms, audible],
      directory,
      logs,
    );
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('sends the warning text on every requested channel at once', async () => {
    const warning = issuedWarning({ channels: [] });

    const states = await disseminator.send(
      warning,
      ['PUSH', 'SMS', 'AUDIBLE'],
      NOW,
    );

    expect(directory.findInDistricts).toHaveBeenCalledWith([
      'COLOMBO',
      'GAMPAHA',
    ]);
    expect(push.send).toHaveBeenCalledWith(
      {
        warningId: WARNING_ID,
        kind: 'WARNING',
        text: expect.stringContaining('HIGH Flood warning'),
        districts: ['COLOMBO', 'GAMPAHA'],
      },
      [{ deviceId: DEVICE_ID, district: 'COLOMBO' }],
    );
    expect(states).toEqual([
      {
        channel: 'PUSH',
        state: 'SENT',
        recipients: 2,
        delivered: 2,
        attempts: 1,
        sentAt: NOW,
      },
      {
        channel: 'SMS',
        state: 'SKIPPED',
        recipients: 0,
        delivered: 0,
        attempts: 1,
      },
      {
        channel: 'AUDIBLE',
        state: 'SENT',
        recipients: 2,
        delivered: 2,
        attempts: 1,
        sentAt: NOW,
      },
    ]);
  });

  it('keeps sending on the other channels when one throws, and records why', async () => {
    sms.send.mockRejectedValue(new Error('SMS gateway is unavailable'));

    const states = await disseminator.send(
      issuedWarning({ channels: [] }),
      ['PUSH', 'SMS', 'AUDIBLE'],
      NOW,
    );

    expect(states.map((s) => s.state)).toEqual(['SENT', 'FAILED', 'SENT']);
    expect(states[1]).toMatchObject({
      lastError: 'SMS gateway is unavailable',
      delivered: 0,
    });
    expect(logs.record).toHaveBeenCalledWith({
      warningId: WARNING_ID,
      channel: 'SMS',
      kind: 'WARNING',
      outcome: 'FAILED',
      message: 'SMS failed: SMS gateway is unavailable',
      recipients: 0,
    });
    expect(logs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'PUSH',
        outcome: 'SENT',
        message: 'Push notification delivered to 2 citizens',
      }),
    );
  });

  it('counts attempts on top of earlier ones and only uses the requested channels', async () => {
    const warning = issuedWarning({
      channels: [
        channel('PUSH'),
        channel('SMS', { state: 'FAILED', attempts: 2 }),
        channel('AUDIBLE'),
      ],
    });

    const states = await disseminator.send(warning, ['SMS'], NOW);

    expect(states).toEqual([
      expect.objectContaining({ channel: 'SMS', attempts: 3 }),
    ]);
    expect(push.send).not.toHaveBeenCalled();
  });

  it('marks every channel failed when recipients cannot be looked up', async () => {
    directory.findInDistricts.mockRejectedValue(new Error('connection reset'));

    const states = await disseminator.send(
      issuedWarning({ channels: [] }),
      ['PUSH', 'SMS', 'AUDIBLE'],
      NOW,
    );

    expect(
      states.every(
        (s) => s.state === 'FAILED' && s.lastError === DIRECTORY_UNAVAILABLE,
      ),
    ).toBe(true);
    expect(push.send).not.toHaveBeenCalled();
    expect(logs.record).toHaveBeenCalledTimes(3);
  });

  it('still returns the states when writing a log fails', async () => {
    logs.record.mockRejectedValue(new Error('db down'));

    const states = await disseminator.send(
      issuedWarning({ channels: [] }),
      ['PUSH'],
      NOW,
    );

    expect(states[0]?.state).toBe('SENT');
  });

  it('announces an All Clear on every channel and logs it, without throwing', async () => {
    const cancelled = issuedWarning({
      status: 'CANCELLED',
      cancellation: {
        cancelledAt: NOW,
        cancelledBy: 'Officer Silva',
        reason: 'Water receded',
      },
    });
    audible.send.mockRejectedValue(new Error('sirens offline'));

    await expect(
      disseminator.announceAllClear(cancelled),
    ).resolves.toBeUndefined();

    expect(push.send).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ALL_CLEAR' }),
      expect.any(Array),
    );
    expect(logs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'AUDIBLE',
        kind: 'ALL_CLEAR',
        outcome: 'FAILED',
      }),
    );
    expect(logs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'PUSH',
        kind: 'ALL_CLEAR',
        message: 'All Clear: Push notification delivered to 2 citizens',
      }),
    );
  });

  it('gives up quietly on the All Clear when recipients cannot be looked up', async () => {
    directory.findInDistricts.mockRejectedValue(new Error('down'));

    await expect(
      disseminator.announceAllClear(issuedWarning()),
    ).resolves.toBeUndefined();
    expect(push.send).not.toHaveBeenCalled();
  });
});
