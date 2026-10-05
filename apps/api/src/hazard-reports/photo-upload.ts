import {
  BadRequestException,
  PipeTransform,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';

import { HAZARD_REPORT_LIMITS } from '@repo/types';

import { detectImageMime } from '../storage/image-type.js';
import type { PhotoUpload } from '../storage/photo-storage.js';

const allowedMimeTypes: readonly string[] = HAZARD_REPORT_LIMITS.photoMimeTypes;

const UNSUPPORTED_MESSAGE = 'Photos must be JPEG, PNG, or WebP images';

/** First line of defence: reject by declared type and size before buffering. */
export const photoUploadOptions: MulterOptions = {
  limits: {
    files: HAZARD_REPORT_LIMITS.photosMax,
    fileSize: HAZARD_REPORT_LIMITS.photoMaxBytes,
  },
  fileFilter: (_request, file, callback) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new UnsupportedMediaTypeException(UNSUPPORTED_MESSAGE), false);
    }
  },
};

/** Second line: the bytes must really be an image, whatever the client claimed. */
export class ValidatePhotosPipe implements PipeTransform<
  PhotoUpload[] | undefined,
  PhotoUpload[]
> {
  transform(files: PhotoUpload[] | undefined): PhotoUpload[] {
    const photos = files ?? [];

    if (photos.length > HAZARD_REPORT_LIMITS.photosMax) {
      throw new BadRequestException(
        `At most ${HAZARD_REPORT_LIMITS.photosMax} photos are allowed`,
      );
    }
    for (const photo of photos) {
      if (detectImageMime(photo.buffer) === null) {
        throw new UnsupportedMediaTypeException(UNSUPPORTED_MESSAGE);
      }
    }
    return photos;
  }
}
