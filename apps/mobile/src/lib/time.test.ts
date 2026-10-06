import { thumbnailUrl } from './cloudinary';
import { formatRelativeTime } from './time';

const now = new Date('2026-10-05T10:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe('formatRelativeTime', () => {
  it.each([
    [0, 'just now'],
    [60_000, '1 min ago'],
    [5 * 60_000, '5 mins ago'],
    [60 * 60_000, '1 hr ago'],
    [3 * 60 * 60_000, '3 hrs ago'],
  ])('shows %i ms as "%s"', (elapsed, expected) => {
    expect(formatRelativeTime(ago(elapsed), now)).toBe(expected);
  });

  it('shows a full date in Sri Lanka time after a day', () => {
    expect(formatRelativeTime('2026-10-03T01:05:00.000Z', now)).toBe(
      '3 Oct 2026, 06:35',
    );
  });

  it('never shows a time in the future as negative', () => {
    expect(formatRelativeTime(ago(-60_000), now)).toBe('just now');
  });
});

describe('thumbnailUrl', () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg';

  it('adds a fill transformation', () => {
    expect(thumbnailUrl(url)).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_400,h_300/v1/a.jpg',
    );
  });

  it('leaves other urls alone', () => {
    expect(thumbnailUrl('https://example.test/a.jpg')).toBe(
      'https://example.test/a.jpg',
    );
  });
});
