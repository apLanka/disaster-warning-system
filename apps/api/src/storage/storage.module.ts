import { Module } from '@nestjs/common';

import { CloudinaryPhotoStorage } from './cloudinary-photo-storage.js';
import { PHOTO_STORAGE } from './photo-storage.js';

@Module({
  providers: [{ provide: PHOTO_STORAGE, useClass: CloudinaryPhotoStorage }],
  exports: [PHOTO_STORAGE],
})
export class StorageModule {}
