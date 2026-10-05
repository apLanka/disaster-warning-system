import { BadGatewayException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import type { Env } from '../config/env.js';
import { JPEG } from '../hazard-reports/testing/fixtures.js';
import {
  CloudinaryPhotoStorage,
  PHOTO_FOLDER,
} from './cloudinary-photo-storage.js';

vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: { upload_stream: vi.fn(), destroy: vi.fn() },
  },
}));

type UploadCallback = (error?: Error, result?: unknown) => void;

const values: Record<string, string> = {
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
};
const config = {
  get: (name: string) => values[name],
} as unknown as ConfigService<Env, true>;

const file = {
  buffer: JPEG,
  mimetype: 'image/jpeg',
  originalname: 'flood.jpg',
  size: JPEG.length,
};

/** Makes upload_stream hand its callback the given outcome once the stream ends. */
function uploadWill(error?: Error, result?: unknown) {
  const end = vi.fn();
  vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(((
    _options: unknown,
    callback: UploadCallback,
  ) => {
    end.mockImplementation(() => callback(error, result));
    return { end };
  }) as never);
  return end;
}

describe('CloudinaryPhotoStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('configures the SDK from the validated environment', () => {
    new CloudinaryPhotoStorage(config);

    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'demo',
      api_key: 'key',
      api_secret: 'secret',
      secure: true,
    });
  });

  it('uploads the buffer into the hazard-reports folder and maps the result', async () => {
    const end = uploadWill(undefined, {
      public_id: 'hazard-reports/abc',
      secure_url: 'https://res.cloudinary.com/demo/abc.jpg',
      width: 640,
      height: 480,
      bytes: 999,
    });

    const result = await new CloudinaryPhotoStorage(config).upload(file);

    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      { folder: PHOTO_FOLDER, resource_type: 'image' },
      expect.any(Function),
    );
    expect(end).toHaveBeenCalledWith(JPEG);
    expect(result).toEqual({
      publicId: 'hazard-reports/abc',
      secureUrl: 'https://res.cloudinary.com/demo/abc.jpg',
      width: 640,
      height: 480,
      bytes: 999,
    });
  });

  it('turns an SDK error into a 502 without leaking its message', async () => {
    uploadWill(new Error('invalid api_secret hunter2'));

    const failure = new CloudinaryPhotoStorage(config).upload(file);

    await expect(failure).rejects.toBeInstanceOf(BadGatewayException);
    await expect(failure).rejects.not.toThrow(/hunter2/);
  });

  it('treats an empty result as a failure', async () => {
    uploadWill(undefined, undefined);

    await expect(
      new CloudinaryPhotoStorage(config).upload(file),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('removes an asset by its public id', async () => {
    vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'ok' });

    await new CloudinaryPhotoStorage(config).remove('hazard-reports/abc');

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      'hazard-reports/abc',
      { resource_type: 'image' },
    );
  });
});
