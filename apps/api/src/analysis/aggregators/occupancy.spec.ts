import {
  buildOccupancySeries,
  peakOccupancy,
  summariseShelters,
} from './occupancy.js';
import { reading, shelter } from '../testing/fixtures.js';

describe('buildOccupancySeries', () => {
  it('is empty for no readings', () => {
    expect(buildOccupancySeries([])).toEqual([]);
  });

  it('follows one shelter reading by reading, including a decrease', () => {
    const series = buildOccupancySeries([
      reading('a', 0, 10),
      reading('a', 6, 40),
      reading('a', 12, 15),
    ]);
    expect(series.map((p) => p.occupancy)).toEqual([10, 40, 15]);
  });

  it("holds each shelter's last reading while another one changes", () => {
    const series = buildOccupancySeries([
      reading('a', 0, 10),
      reading('b', 3, 5),
      reading('a', 6, 20),
      reading('b', 9, 0),
    ]);
    expect(series.map((p) => p.occupancy)).toEqual([10, 15, 25, 20]);
  });

  it('sorts out-of-order input', () => {
    const series = buildOccupancySeries([
      reading('a', 6, 40),
      reading('a', 0, 10),
    ]);
    expect(series.map((p) => p.occupancy)).toEqual([10, 40]);
  });

  it('gives one point when readings share a time', () => {
    const series = buildOccupancySeries([
      reading('a', 0, 10),
      reading('b', 0, 5),
    ]);
    expect(series).toEqual([{ at: '2026-03-10T00:00:00.000Z', occupancy: 15 }]);
  });

  it('does not change its input', () => {
    const input = [reading('a', 6, 40), reading('a', 0, 10)];
    buildOccupancySeries(input);
    expect(input[0]!.occupancyCount).toBe(40);
  });
});

describe('peakOccupancy', () => {
  const shelters = [shelter('a', 'CMB', 100), shelter('b', 'GMP', 50)];

  it('is null when there are no readings', () => {
    expect(peakOccupancy([], shelters)).toBeNull();
  });

  it('gives the highest total, its first time, and the combined capacity', () => {
    const series = [
      { at: '2026-03-10T00:00:00.000Z', occupancy: 10 },
      { at: '2026-03-10T06:00:00.000Z', occupancy: 90 },
      { at: '2026-03-10T12:00:00.000Z', occupancy: 90 },
      { at: '2026-03-10T18:00:00.000Z', occupancy: 20 },
    ];
    expect(peakOccupancy(series, shelters)).toEqual({
      value: 90,
      at: '2026-03-10T06:00:00.000Z',
      capacity: 150,
    });
  });

  it('handles a single point', () => {
    expect(
      peakOccupancy(
        [{ at: '2026-03-10T00:00:00.000Z', occupancy: 0 }],
        shelters,
      ),
    ).toMatchObject({ value: 0 });
  });
});

describe('summariseShelters', () => {
  it('gives peak, latest by time (not by input order) and pending counts per shelter', () => {
    const [a, b] = summariseShelters(
      [shelter('a'), shelter('b', 'GMP', 50)],
      [
        reading('a', 12, 30, 'PENDING'),
        reading('a', 0, 10),
        reading('a', 6, 60),
      ],
    );
    expect(a).toMatchObject({
      shelterId: 'a',
      capacity: 100,
      peakOccupancy: 60,
      latestOccupancy: 30,
      pendingRecords: 1,
      status: 'OPEN',
    });
    expect(b).toMatchObject({
      peakOccupancy: 0,
      latestOccupancy: 0,
      pendingRecords: 0,
    });
  });
});
