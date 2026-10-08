import type { WarningEntity } from './domain/analysis.entities.js';
import { sumReached } from './reach.js';

const warning = (districts: Array<[string, number]>): WarningEntity => ({
  id: 'w',
  eventId: 'e',
  issuedAt: new Date(),
  level: 'HIGH',
  label: 'INITIAL_ALERT',
  title: 't',
  districts: districts.map(([districtCode, reached]) => ({
    districtCode: districtCode as 'CMB',
    targeted: 1000,
    reached,
  })),
});

describe('sumReached', () => {
  const warnings = [
    warning([
      ['CMB', 100],
      ['GMP', 50],
    ]),
    warning([['CMB', 70]]),
  ];

  it('sums every district when none is given', () => {
    expect(sumReached(warnings)).toBe(220);
  });

  it('sums only the given districts', () => {
    expect(sumReached(warnings, ['CMB'])).toBe(170);
    expect(sumReached(warnings, ['GMP'])).toBe(50);
  });

  it('is zero for no warnings or an uncovered district', () => {
    expect(sumReached([])).toBe(0);
    expect(sumReached(warnings, ['KAL'])).toBe(0);
  });
});
