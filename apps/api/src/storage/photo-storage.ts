import type { HazardPhoto } from '@repo/types';

export const PHOTO_STORAGE = Symbol('PHOTO_STORAGE');

/** An uploaded file as received from multer's memory storage. */
export interface PhotoUpload {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/** Where photo evidence lives. Implementations can be swapped without touching the service. */
export interface PhotoStorage {
  upload(file: PhotoUpload): Promise<HazardPhoto>;
  remove(publicId: string): Promise<void>;
}
