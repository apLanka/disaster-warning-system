import { assertConsistent, InconsistentRecordsError } from './consistency.js';
import {
  distribution,
  reading,
  shelter,
  warning,
} from '../testing/fixtures.js';

const ok = {
  warnings: [warning('w', 0, [['CMB', 100, 80]])],
  shelters: [shelter('a')],
  occupancyRecords: [reading('a', 0, 10)],
  distributions: [distribution('d', 'CMB', 5)],
};

const problemsOf = (input: Parameters<typeof assertConsistent>[0]) => {
  try {
    assertConsistent(input);
  } catch (error) {
    expect(error).toBeInstanceOf(InconsistentRecordsError);
    return (error as InconsistentRecordsError).problems;
  }
  return [];
};

describe('assertConsistent', () => {
  it('accepts consistent records, including none at all', () => {
    expect(() => assertConsistent(ok)).not.toThrow();
    expect(() =>
      assertConsistent({
        warnings: [],
        shelters: [],
        occupancyRecords: [],
        distributions: [],
      }),
    ).not.toThrow();
  });

  it('rejects a negative or fractional occupancy', () => {
    expect(
      problemsOf({ ...ok, occupancyRecords: [reading('a', 0, -3)] })[0],
    ).toContain('invalid occupancy -3');
    expect(
      problemsOf({ ...ok, occupancyRecords: [reading('a', 0, 2.5)] }),
    ).toHaveLength(1);
  });

  it('rejects a reading for an unknown shelter', () => {
    expect(
      problemsOf({ ...ok, occupancyRecords: [reading('ghost', 0, 5)] })[0],
    ).toContain('unknown shelter ghost');
  });

  it('rejects a zero, negative or fractional quantity', () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(
        problemsOf({
          ...ok,
          distributions: [distribution('d', 'CMB', quantity)],
        }),
      ).toHaveLength(1);
    }
  });

  it('rejects reached above targeted, or negative reach', () => {
    expect(
      problemsOf({
        ...ok,
        warnings: [warning('w', 0, [['CMB', 100, 101]])],
      })[0],
    ).toContain('invalid reach for CMB');
    expect(
      problemsOf({ ...ok, warnings: [warning('w', 0, [['CMB', 100, -1]])] }),
    ).toHaveLength(1);
  });

  it('lists every problem in one error', () => {
    const problems = problemsOf({
      ...ok,
      occupancyRecords: [reading('a', 0, -1), reading('ghost', 1, 1)],
      distributions: [distribution('d', 'CMB', 0)],
    });
    expect(problems).toHaveLength(3);
    expect(() =>
      assertConsistent({ ...ok, distributions: [distribution('d', 'CMB', 0)] }),
    ).toThrow(/Inconsistent records: resource distribution d/);
  });
});
