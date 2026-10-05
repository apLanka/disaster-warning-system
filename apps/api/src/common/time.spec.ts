import { startOfColomboDay } from './time.js';

describe('startOfColomboDay', () => {
  it('returns Colombo midnight, which is 18:30 UTC the day before', () => {
    expect(startOfColomboDay(new Date('2026-10-05T10:00:00.000Z'))).toEqual(
      new Date('2026-10-04T18:30:00.000Z'),
    );
  });

  it('rolls over at 18:30 UTC, when it is already tomorrow in Sri Lanka', () => {
    expect(startOfColomboDay(new Date('2026-10-05T18:29:59.999Z'))).toEqual(
      new Date('2026-10-04T18:30:00.000Z'),
    );
    expect(startOfColomboDay(new Date('2026-10-05T18:30:00.000Z'))).toEqual(
      new Date('2026-10-05T18:30:00.000Z'),
    );
  });

  it('counts the early hours in Colombo as the new day', () => {
    // 19:00 UTC is 00:30 the next morning in Colombo.
    expect(startOfColomboDay(new Date('2026-10-05T19:00:00.000Z'))).toEqual(
      new Date('2026-10-05T18:30:00.000Z'),
    );
  });

  it('works across a year boundary', () => {
    expect(startOfColomboDay(new Date('2026-12-31T20:00:00.000Z'))).toEqual(
      new Date('2026-12-31T18:30:00.000Z'),
    );
  });
});
