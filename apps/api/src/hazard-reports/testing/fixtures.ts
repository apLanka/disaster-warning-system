import type { HazardPhoto } from '@repo/types';

import type { PhotoStorage } from '../../storage/photo-storage.js';
import type { HazardReportEntity } from '../domain/hazard-report.entity.js';
import type { HazardReportRepository } from '../hazard-report.repository.js';

export const REPORTER_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
export const CLIENT_REQUEST_ID = '7b0e6c0e-0f5e-4a52-9a77-3d3a0c1f9a11';

/** Smallest buffers that carry each image signature. */
export const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
export const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
export const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
]);
export const NOT_AN_IMAGE = Buffer.from(
  '<html>definitely not a picture</html>',
);

export function photo(n = 1): HazardPhoto {
  return {
    publicId: `hazard-reports/photo-${n}`,
    secureUrl: `https://res.cloudinary.com/demo/image/upload/photo-${n}.jpg`,
    width: 800,
    height: 600,
    bytes: 1234,
  };
}

export function entity(
  overrides: Partial<HazardReportEntity> = {},
): HazardReportEntity {
  return {
    id: '665f1f77bcf86cd799439011',
    reference: 'HR-2026-0001',
    reporterId: REPORTER_ID,
    clientRequestId: CLIENT_REQUEST_ID,
    type: 'FLOOD',
    description: 'Water is rising near the bridge',
    location: { latitude: 7.2906, longitude: 80.6337 },
    photos: [],
    status: 'PENDING_VERIFICATION',
    createdAt: new Date('2026-10-05T06:35:00.000Z'),
    updatedAt: new Date('2026-10-05T06:35:00.000Z'),
    ...overrides,
  };
}

export function fakeRepository() {
  return {
    create: vi.fn<HazardReportRepository['create']>(),
    findById: vi.fn<HazardReportRepository['findById']>(),
    findByClientRequestId:
      vi.fn<HazardReportRepository['findByClientRequestId']>(),
    findByReporter: vi.fn<HazardReportRepository['findByReporter']>(),
    list: vi.fn<HazardReportRepository['list']>(),
    stats: vi.fn<HazardReportRepository['stats']>(),
    decide: vi.fn<HazardReportRepository['decide']>(),
  };
}

export function fakePhotoStorage() {
  let counter = 0;
  return {
    upload: vi
      .fn<PhotoStorage['upload']>()
      .mockImplementation(async () => photo(++counter)),
    remove: vi.fn<PhotoStorage['remove']>().mockResolvedValue(undefined),
  };
}
