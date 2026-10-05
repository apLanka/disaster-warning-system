import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import type { HazardPhoto } from '@repo/types';

import type { Env } from '../config/env.js';
import type { PhotoStorage, PhotoUpload } from './photo-storage.js';

export const PHOTO_FOLDER = 'hazard-reports';

interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  bytes: number;
}

@Injectable()
export class CloudinaryPhotoStorage implements PhotoStorage {
  private readonly logger = new Logger(CloudinaryPhotoStorage.name);

  constructor(config: ConfigService<Env, true>) {
    cloudinary.config({
      cloud_name: config.get('CLOUDINARY_CLOUD_NAME', { infer: true }),
      api_key: config.get('CLOUDINARY_API_KEY', { infer: true }),
      api_secret: config.get('CLOUDINARY_API_SECRET', { infer: true }),
      secure: true,
    });
  }

  async upload(file: PhotoUpload): Promise<HazardPhoto> {
    try {
      const result = await new Promise<CloudinaryUploadResult>(
        (resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: PHOTO_FOLDER, resource_type: 'image' },
            (error, uploaded) => {
              if (error || !uploaded) {
                reject(error ?? new Error('Cloudinary returned no result'));
              } else {
                resolve(uploaded);
              }
            },
          );
          stream.end(file.buffer);
        },
      );

      return {
        publicId: result.public_id,
        secureUrl: result.secure_url,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      };
    } catch (error) {
      this.logger.error(
        `Photo upload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadGatewayException('Photo upload failed. Please try again.');
    }
  }

  async remove(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  }
}
