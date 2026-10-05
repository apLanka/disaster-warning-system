import {
  BadRequestException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

import { HAZARD_REPORT_LIMITS } from '@repo/types';

import type { PhotoUpload } from '../storage/photo-storage.js';
import { photoUploadOptions, ValidatePhotosPipe } from './photo-upload.js';
import { JPEG, NOT_AN_IMAGE, PNG, WEBP } from './testing/fixtures.js';

function upload(buffer: Buffer): PhotoUpload {
  return {
    buffer,
    mimetype: 'image/jpeg',
    originalname: 'a.jpg',
    size: buffer.length,
  };
}

describe('photoUploadOptions', () => {
  it('limits the number and size of files', () => {
    expect(photoUploadOptions.limits).toEqual({
      files: HAZARD_REPORT_LIMITS.photosMax,
      fileSize: HAZARD_REPORT_LIMITS.photoMaxBytes,
    });
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])(
    'accepts %s',
    (mimetype) => {
      const callback = vi.fn();

      photoUploadOptions.fileFilter?.(
        {} as never,
        { mimetype } as never,
        callback,
      );

      expect(callback).toHaveBeenCalledWith(null, true);
    },
  );

  it.each(['text/plain', 'application/pdf', 'image/gif', 'image/svg+xml'])(
    'rejects %s with a 415',
    (mimetype) => {
      const callback = vi.fn();

      photoUploadOptions.fileFilter?.(
        {} as never,
        { mimetype } as never,
        callback,
      );

      expect(callback).toHaveBeenCalledWith(
        expect.any(UnsupportedMediaTypeException),
        false,
      );
    },
  );
});

describe('ValidatePhotosPipe', () => {
  const pipe = new ValidatePhotosPipe();

  it('treats no files as an empty list', () => {
    expect(pipe.transform(undefined)).toEqual([]);
  });

  it('passes real images through', () => {
    const files = [upload(JPEG), upload(PNG), upload(WEBP)];

    expect(pipe.transform(files)).toBe(files);
  });

  it('rejects a file whose bytes are not an image, whatever it claims to be', () => {
    expect(() => pipe.transform([upload(JPEG), upload(NOT_AN_IMAGE)])).toThrow(
      UnsupportedMediaTypeException,
    );
  });

  it('allows the maximum number of photos but not one more', () => {
    const max = HAZARD_REPORT_LIMITS.photosMax;

    expect(
      pipe.transform(Array.from({ length: max }, () => upload(JPEG))),
    ).toHaveLength(max);
    expect(() =>
      pipe.transform(Array.from({ length: max + 1 }, () => upload(JPEG))),
    ).toThrow(BadRequestException);
  });
});
