import { alert } from '../test/fixtures';
import {
  activeAlerts,
  alertTitle,
  describeAlertDistricts,
  formatLocalMobile,
  highestLevel,
  mapsUrl,
  unacknowledged,
} from './alerts';
import { formatDateTime } from './time';

describe('alert helpers', () => {
  const list = [
    alert({ id: 'a', level: 'MEDIUM' }),
    alert({
      id: 'b',
      level: 'CRITICAL',
      acknowledgedAt: '2026-10-07T10:00:00.000Z',
    }),
    alert({ id: 'c', level: 'CRITICAL', state: 'ALL_CLEAR' }),
  ];

  it('picks active, unacknowledged and the most severe level', () => {
    expect(activeAlerts(list).map((a) => a.id)).toEqual(['a', 'b']);
    expect(unacknowledged(list).map((a) => a.id)).toEqual(['a']);
    expect(highestLevel(list)).toBe('CRITICAL');
    expect(highestLevel([list[2]!])).toBeNull();
  });

  it('formats titles, districts, map links, phones and times', () => {
    expect(alertTitle(alert({ hazardType: 'LANDSLIDE' }))).toBe(
      'LANDSLIDE WARNING',
    );
    expect(
      describeAlertDistricts(alert({ districts: ['COLOMBO', 'NUWARA_ELIYA'] })),
    ).toBe('Colombo, Nuwara Eliya');
    expect(mapsUrl('COLOMBO')).toBe(
      'https://www.google.com/maps/search/?api=1&query=6.9271,79.8612',
    );
    expect(formatLocalMobile('+94771234567')).toBe('077 123 4567');
    expect(formatDateTime('2026-10-07T09:00:00.000Z')).toBe(
      '7 Oct 2026, 14:30',
    );
  });
});
