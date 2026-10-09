import {
  channel,
  hoursFromNow,
  issuedWarning,
  NOW,
  warningEntity,
} from '../testing/fixtures.js';
import {
  allClearMessage,
  citizenAlertState,
  contentProblems,
  describeDistricts,
  initialChannels,
  isActive,
  issueProblems,
  mergeChannels,
  overallStatus,
  retryableChannels,
  warningMessage,
} from './warning-rules.js';

describe('isActive', () => {
  it('is true for an issued warning before validUntil', () => {
    expect(isActive(issuedWarning(), NOW)).toBe(true);
  });

  it.each(['DRAFT', 'CANCELLED'] as const)('is false for %s', (status) => {
    expect(isActive(issuedWarning({ status }), NOW)).toBe(false);
  });

  it('is false once validUntil has passed, and exactly at validUntil', () => {
    expect(isActive(issuedWarning({ validUntil: hoursFromNow(-1) }), NOW)).toBe(
      false,
    );
    expect(isActive(issuedWarning({ validUntil: NOW }), NOW)).toBe(false);
  });
});

describe('overallStatus', () => {
  it('is DISSEMINATED when every channel sent or had nobody to reach', () => {
    expect(
      overallStatus([
        channel('PUSH'),
        channel('SMS', { state: 'SKIPPED' }),
        channel('AUDIBLE'),
      ]),
    ).toBe('DISSEMINATED');
  });

  it('is PARTIALLY_DISSEMINATED when one channel failed and another sent', () => {
    expect(
      overallStatus([
        channel('PUSH'),
        channel('SMS', { state: 'FAILED' }),
        channel('AUDIBLE'),
      ]),
    ).toBe('PARTIALLY_DISSEMINATED');
  });

  it('is PENDING_DISSEMINATION when nothing was sent', () => {
    expect(
      overallStatus([
        channel('PUSH', { state: 'FAILED' }),
        channel('SMS', { state: 'SKIPPED' }),
        channel('AUDIBLE', { state: 'PENDING' }),
      ]),
    ).toBe('PENDING_DISSEMINATION');
  });
});

describe('initialChannels and mergeChannels', () => {
  it('starts every channel as PENDING with no attempts, in channel order', () => {
    expect(initialChannels()).toEqual([
      {
        channel: 'PUSH',
        state: 'PENDING',
        recipients: 0,
        delivered: 0,
        attempts: 0,
      },
      {
        channel: 'SMS',
        state: 'PENDING',
        recipients: 0,
        delivered: 0,
        attempts: 0,
      },
      {
        channel: 'AUDIBLE',
        state: 'PENDING',
        recipients: 0,
        delivered: 0,
        attempts: 0,
      },
    ]);
  });

  it('replaces only the channels that were re-sent', () => {
    const current = [
      channel('PUSH'),
      channel('SMS', { state: 'FAILED' }),
      channel('AUDIBLE'),
    ];
    const retried = channel('SMS', { attempts: 2 });

    expect(mergeChannels(current, [retried])).toEqual([
      current[0],
      retried,
      current[2],
    ]);
  });
});

describe('retryableChannels', () => {
  it('lists FAILED and PENDING channels only', () => {
    expect(
      retryableChannels([
        channel('PUSH'),
        channel('SMS', { state: 'FAILED' }),
        channel('AUDIBLE', { state: 'PENDING' }),
      ]),
    ).toEqual(['SMS', 'AUDIBLE']);
  });
});

describe('contentProblems and issueProblems', () => {
  it('accepts a complete warning', () => {
    expect(issueProblems(warningEntity(), NOW)).toEqual([]);
  });

  it('rejects a period that ends before it starts, even for a draft', () => {
    const content = warningEntity({
      validFrom: hoursFromNow(2),
      validUntil: hoursFromNow(1),
    });
    expect(contentProblems(content)).toEqual([
      'validUntil must be after validFrom',
    ]);
  });

  it('lists everything missing before a warning can be issued', () => {
    const content = warningEntity({
      description: undefined,
      safetyInstructions: [],
      validUntil: undefined,
    });

    expect(issueProblems(content, NOW)).toEqual([
      'description is required to issue a warning',
      'add at least one safety instruction',
      'validUntil is required to issue a warning',
    ]);
  });

  it('refuses to issue a warning that has already expired', () => {
    const content = warningEntity({
      validFrom: undefined,
      validUntil: hoursFromNow(-1),
    });
    expect(issueProblems(content, NOW)).toEqual([
      'validUntil must be in the future',
    ]);
  });
});

describe('citizenAlertState', () => {
  it('is ACTIVE while the warning is active', () => {
    expect(citizenAlertState(issuedWarning(), NOW)).toBe('ACTIVE');
  });

  it('is ALL_CLEAR for a recent cancellation and hidden after 7 days', () => {
    const cancelled = (hoursAgo: number) =>
      issuedWarning({
        status: 'CANCELLED',
        cancellation: {
          cancelledAt: hoursFromNow(-hoursAgo),
          cancelledBy: 'Officer Silva',
          reason: 'Water receded',
        },
      });

    expect(citizenAlertState(cancelled(1), NOW)).toBe('ALL_CLEAR');
    expect(citizenAlertState(cancelled(24 * 8), NOW)).toBeNull();
  });

  it('is EXPIRED for a recent expiry and hidden after 7 days', () => {
    expect(
      citizenAlertState(issuedWarning({ validUntil: hoursFromNow(-2) }), NOW),
    ).toBe('EXPIRED');
    expect(
      citizenAlertState(
        issuedWarning({ validUntil: hoursFromNow(-24 * 8) }),
        NOW,
      ),
    ).toBeNull();
  });

  it('never shows a draft', () => {
    expect(citizenAlertState(warningEntity(), NOW)).toBeNull();
  });
});

describe('messages', () => {
  it('names the districts in reading form', () => {
    expect(describeDistricts(['COLOMBO', 'NUWARA_ELIYA'])).toBe(
      'Colombo, Nuwara Eliya',
    );
  });

  it('builds the warning text sent on every channel', () => {
    expect(warningMessage(issuedWarning())).toBe(
      'HIGH Flood warning for Colombo, Gampaha (HW-2026-0001): Heavy rainfall expected. Evacuate low-lying areas.',
    );
  });

  it('builds the All Clear text with the officer reason', () => {
    const cancelled = issuedWarning({
      status: 'CANCELLED',
      cancellation: {
        cancelledAt: NOW,
        cancelledBy: 'Officer Silva',
        reason: 'Water has receded',
      },
    });
    expect(allClearMessage(cancelled)).toBe(
      'ALL CLEAR: the Flood warning HW-2026-0001 for Colombo, Gampaha has been lifted. Water has receded',
    );
  });
});
