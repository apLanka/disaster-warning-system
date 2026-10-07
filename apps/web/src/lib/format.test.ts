import { describe, expect, it } from 'vitest';

import {
  formatCoordinates,
  formatDate,
  formatDayTime,
  formatNumber,
  formatPercent,
  formatPeriod,
  formatIncidentTime,
  formatRelativeTime,
  isStale,
  minutesSince,
} from './format';

const now = new Date('2026-10-05T10:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

describe('formatRelativeTime', () => {
  it.each([
    [0, 'just now'],
    [59_000, 'just now'],
    [MIN, '1 min ago'],
    [2 * MIN, '2 mins ago'],
    [59 * MIN, '59 mins ago'],
    [HOUR, '1 hr ago'],
    [5 * HOUR, '5 hrs ago'],
  ])('shows %i ms as "%s"', (elapsed, expected) => {
    expect(formatRelativeTime(ago(elapsed), now)).toBe(expected);
  });

  it('switches to the absolute date and time in Sri Lanka after a day', () => {
    // 2026-10-03 01:05Z is 06:35 in Colombo.
    expect(formatRelativeTime('2026-10-03T01:05:00.000Z', now)).toBe(
      '3 Oct 2026, 06:35',
    );
  });

  it('does not show a time in the future as negative', () => {
    expect(formatRelativeTime(ago(-5 * MIN), now)).toBe('just now');
  });
});

describe('formatIncidentTime', () => {
  it('says "Today" for the same day in Sri Lanka', () => {
    expect(formatIncidentTime('2026-10-05T01:05:00.000Z', now)).toBe(
      'Today, 06:35 AM',
    );
  });

  it('judges "today" by the Sri Lanka calendar, not UTC', () => {
    // 19:00Z on the 4th is already 00:30 on the 5th in Colombo.
    expect(formatIncidentTime('2026-10-04T19:00:00.000Z', now)).toBe(
      'Today, 12:30 AM',
    );
  });

  it('shows the full date for another day', () => {
    expect(formatIncidentTime('2026-10-03T01:05:00.000Z', now)).toBe(
      '3 Oct 2026, 06:35',
    );
  });
});

describe('staleness', () => {
  it('counts whole minutes since the report', () => {
    expect(minutesSince(ago(45 * MIN + 30_000), now)).toBe(45);
  });

  it('flags a report only once it has waited more than 30 minutes', () => {
    expect(isStale(ago(30 * MIN), now)).toBe(false);
    expect(isStale(ago(31 * MIN), now)).toBe(true);
    expect(isStale(ago(2 * MIN), now)).toBe(false);
  });
});

describe('formatCoordinates', () => {
  it('uses four decimals and hemisphere letters', () => {
    expect(formatCoordinates({ latitude: 7.2906, longitude: 80.6337 })).toBe(
      '7.2906° N, 80.6337° E',
    );
  });

  it('uses S and W for negative values without a minus sign', () => {
    expect(formatCoordinates({ latitude: -33.8688, longitude: -70.5 })).toBe(
      '33.8688° S, 70.5000° W',
    );
  });

  it('rounds to four decimals', () => {
    expect(
      formatCoordinates({ latitude: 7.123456, longitude: 80.987654 }),
    ).toBe('7.1235° N, 80.9877° E');
  });
});

describe('analysis formatting', () => {
  it('formats a date in Sri Lanka time', () => {
    // 2026-03-09 20:00Z is already the next day, 10 March, in Colombo.
    expect(formatDate('2026-03-09T20:00:00.000Z')).toBe('10 Mar 2026');
  });

  it('formats a period, with "ongoing" when it has no end', () => {
    expect(
      formatPeriod('2026-03-10T04:00:00.000Z', '2026-03-12T16:00:00.000Z'),
    ).toBe('10 Mar 2026 - 12 Mar 2026');
    expect(formatPeriod('2026-03-10T04:00:00.000Z', null)).toBe(
      '10 Mar 2026 - ongoing',
    );
  });

  it('formats a day and time for an axis or timeline', () => {
    expect(formatDayTime('2026-03-10T04:00:00.000Z')).toBe('10 Mar, 09:30');
  });

  it('formats numbers and percentages', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(0)).toBe('0');
    expect(formatPercent(0.8421)).toBe('84.2%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(1)).toBe('100.0%');
  });
});
