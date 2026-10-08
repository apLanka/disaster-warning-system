import { summariseWarnings } from './warnings.js';
import { warning } from '../testing/fixtures.js';

const warnings = [
  warning('late', 10, [['CMB', 1000, 900]]),
  warning('early', 0, [
    ['CMB', 1000, 800],
    ['GMP', 500, 400],
  ]),
];

describe('summariseWarnings', () => {
  it('orders the timeline by time and totals every district in scope', () => {
    const result = summariseWarnings(warnings, ['CMB', 'GMP']);
    expect(result.timeline.map((t) => t.id)).toEqual(['early', 'late']);
    expect(result.targeted).toBe(2500);
    expect(result.reached).toBe(2100);
    expect(result.reachRate).toBeCloseTo(0.84);
  });

  it('narrows to one district: only its numbers, and only warnings that cover it', () => {
    const result = summariseWarnings(warnings, ['GMP']);
    expect(result.timeline).toEqual([
      expect.objectContaining({ id: 'early', targeted: 500, reached: 400 }),
    ]);
    expect(result.targeted).toBe(500);
    expect(result.reached).toBe(400);
  });

  it('gives a zero rate, not NaN, when nothing was targeted', () => {
    const none = summariseWarnings([], ['CMB']);
    expect(none).toEqual({
      timeline: [],
      targeted: 0,
      reached: 0,
      reachRate: 0,
    });
    expect(summariseWarnings(warnings, ['KAL']).reachRate).toBe(0);
  });

  it('formats the time as ISO text and keeps the label and level', () => {
    const [item] = summariseWarnings(warnings, ['CMB']).timeline;
    expect(item).toMatchObject({
      at: '2026-03-10T00:00:00.000Z',
      level: 'HIGH',
      label: 'INITIAL_ALERT',
    });
  });
});
