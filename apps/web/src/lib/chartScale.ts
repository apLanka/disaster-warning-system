/** Pure helpers for the hand-drawn SVG charts, tested on their own. */

/** Rounds up to 1, 2, 5 or 10 times a power of ten, so axes end on a tidy number. Never below 1. */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  const step = [1, 2, 5, 10].find((candidate) => fraction <= candidate) ?? 10;
  return step * power;
}

/** Evenly spaced tick values from 0 to `max`, inclusive. */
export function ticks(max: number, intervals = 4): number[] {
  return Array.from(
    { length: intervals + 1 },
    (_, index) => (max / intervals) * index,
  );
}

/**
 * Maps a value in [domainMin, domainMax] to [rangeMin, rangeMax]. A domain with no
 * width (one point, or equal values) maps everything to the middle of the range.
 */
export function linearScale(
  [domainMin, domainMax]: readonly [number, number],
  [rangeMin, rangeMax]: readonly [number, number],
): (value: number) => number {
  if (domainMax === domainMin) {
    const middle = (rangeMin + rangeMax) / 2;
    return () => middle;
  }
  const ratio = (rangeMax - rangeMin) / (domainMax - domainMin);
  return (value) => rangeMin + (value - domainMin) * ratio;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * An SVG path for a step function: each value holds (a horizontal line) until the
 * next point, then jumps (a vertical line). Empty input gives an empty path.
 */
export function stepPath(points: readonly Point[]): string {
  const [first, ...rest] = points;
  if (!first) return '';
  let path = `M${round(first.x)},${round(first.y)}`;
  for (const point of rest) {
    path += ` H${round(point.x)} V${round(point.y)}`;
  }
  return path;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
