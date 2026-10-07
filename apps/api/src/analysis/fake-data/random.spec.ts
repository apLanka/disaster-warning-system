import { createRandom, randomInt } from './random.js';

const take = (seed: number, n: number) => {
  const random = createRandom(seed);
  return Array.from({ length: n }, () => random());
};

describe('createRandom', () => {
  it('gives the same numbers for the same seed', () => {
    expect(take(42, 20)).toEqual(take(42, 20));
  });

  it('gives different numbers for different seeds', () => {
    expect(take(1, 5)).not.toEqual(take(2, 5));
  });

  it('stays within [0, 1)', () => {
    for (const value of take(7, 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('randomInt', () => {
  it('stays within the bounds and reaches both ends', () => {
    const random = createRandom(3);
    const values = Array.from({ length: 500 }, () => randomInt(random, 2, 5));
    expect(Math.min(...values)).toBe(2);
    expect(Math.max(...values)).toBe(5);
    expect(values.every(Number.isInteger)).toBe(true);
  });

  it('returns the only value when min equals max', () => {
    expect(randomInt(createRandom(1), 4, 4)).toBe(4);
  });
});
