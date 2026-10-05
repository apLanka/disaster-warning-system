import { describe, expect, it } from 'vitest';

import { thumbnailUrl } from './cloudinary';

const url =
  'https://res.cloudinary.com/demo/image/upload/v1/hazard-reports/a.jpg';

describe('thumbnailUrl', () => {
  it('inserts a fill transformation after /upload/', () => {
    expect(thumbnailUrl(url)).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_160,h_120/v1/hazard-reports/a.jpg',
    );
  });

  it('accepts a custom size', () => {
    expect(thumbnailUrl(url, 400, 300)).toContain('c_fill,w_400,h_300');
  });

  it('leaves a non-Cloudinary url alone', () => {
    expect(thumbnailUrl('https://example.test/a.jpg')).toBe(
      'https://example.test/a.jpg',
    );
  });
});
