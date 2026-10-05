import {
  JPEG,
  NOT_AN_IMAGE,
  PNG,
  WEBP,
} from '../hazard-reports/testing/fixtures.js';
import { detectImageMime } from './image-type.js';

describe('detectImageMime', () => {
  it.each([
    ['jpeg', JPEG, 'image/jpeg'],
    ['png', PNG, 'image/png'],
    ['webp', WEBP, 'image/webp'],
  ])('recognises %s by its signature', (_name, buffer, expected) => {
    expect(detectImageMime(buffer)).toBe(expected);
  });

  it('rejects text, even text that looks like a document', () => {
    expect(detectImageMime(NOT_AN_IMAGE)).toBeNull();
  });

  it('rejects an empty buffer', () => {
    expect(detectImageMime(Buffer.alloc(0))).toBeNull();
  });

  it('rejects a RIFF container that is not WebP', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WAVE'),
    ]);

    expect(detectImageMime(wav)).toBeNull();
  });

  it('rejects a buffer shorter than the PNG signature', () => {
    expect(detectImageMime(PNG.subarray(0, 4))).toBeNull();
  });
});
