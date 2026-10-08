import { describe, expect, it } from 'vitest';

import { linearScale, niceMax, stepPath, ticks } from './chartScale';

describe('niceMax', () => {
  it.each([
    [0, 1],
    [-5, 1],
    [0.4, 1],
    [1, 1],
    [1.1, 2],
    [2, 2],
    [3, 5],
    [5, 5],
    [5.1, 10],
    [7, 10],
    [10, 10],
    [11, 20],
    [540, 1000],
    [901, 1000],
    [1001, 2000],
    [24_500, 50_000],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
  ])('rounds %f up to %f', (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });
});

describe('ticks', () => {
  it('spaces ticks evenly from zero to the maximum', () => {
    expect(ticks(100)).toEqual([0, 25, 50, 75, 100]);
    expect(ticks(10, 2)).toEqual([0, 5, 10]);
  });

  it('gives zeros for a zero maximum', () => {
    expect(ticks(0, 2)).toEqual([0, 0, 0]);
  });
});

describe('linearScale', () => {
  it('maps the ends of the domain to the ends of the range', () => {
    const scale = linearScale([0, 10], [100, 200]);
    expect(scale(0)).toBe(100);
    expect(scale(10)).toBe(200);
    expect(scale(5)).toBe(150);
  });

  it('supports an inverted range, as SVG y axes need', () => {
    const scale = linearScale([0, 100], [200, 20]);
    expect(scale(0)).toBe(200);
    expect(scale(100)).toBe(20);
  });

  it('puts everything in the middle when the domain has no width', () => {
    const scale = linearScale([5, 5], [0, 100]);
    expect(scale(5)).toBe(50);
    expect(scale(99)).toBe(50);
  });
});

describe('stepPath', () => {
  it('is empty without points', () => {
    expect(stepPath([])).toBe('');
  });

  it('is only a move for a single point', () => {
    expect(stepPath([{ x: 10, y: 20 }])).toBe('M10,20');
  });

  it('holds each value until the next point, then jumps', () => {
    expect(
      stepPath([
        { x: 0, y: 100 },
        { x: 50, y: 40 },
        { x: 80, y: 90 },
      ]),
    ).toBe('M0,100 H50 V40 H80 V90');
  });

  it('rounds to two decimals', () => {
    expect(
      stepPath([
        { x: 1.23456, y: 2.34567 },
        { x: 3.14159, y: 4 },
      ]),
    ).toBe('M1.23,2.35 H3.14 V4');
  });
});
