import { ConflictException, Logger } from '@nestjs/common';

import type { PhotoUpload } from '../storage/photo-storage.js';
import type { CreateHazardReportDto } from './dto/create-hazard-report.dto.js';
import { HazardReportsService } from './hazard-reports.service.js';
import {
  CLIENT_REQUEST_ID,
  entity,
  fakePhotoStorage,
  fakeRepository,
  JPEG,
  photo,
  REPORTER_ID,
} from './testing/fixtures.js';

const dto: CreateHazardReportDto = {
  clientRequestId: CLIENT_REQUEST_ID,
  type: 'FLOOD',
  description: 'Water is rising near the bridge',
  latitude: 7.2906,
  longitude: 80.6337,
  reporterName: 'Nimal Perera',
};

function file(name = 'a.jpg'): PhotoUpload {
  return {
    buffer: JPEG,
    mimetype: 'image/jpeg',
    originalname: name,
    size: JPEG.length,
  };
}

describe('HazardReportsService.submit', () => {
  let repository: ReturnType<typeof fakeRepository>;
  let storage: ReturnType<typeof fakePhotoStorage>;
  let service: HazardReportsService;

  beforeEach(() => {
    repository = fakeRepository();
    storage = fakePhotoStorage();
    repository.findByClientRequestId.mockResolvedValue(null);
    repository.create.mockImplementation(async (input) => ({
      report: entity({ photos: input.photos }),
      created: true,
    }));
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    service = new HazardReportsService(repository, storage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uploads the photos, then stores the report with their details', async () => {
    const result = await service.submit(REPORTER_ID, dto, [
      file('a.jpg'),
      file('b.jpg'),
    ]);

    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(repository.create).toHaveBeenCalledWith({
      reporterId: REPORTER_ID,
      clientRequestId: CLIENT_REQUEST_ID,
      reporterName: 'Nimal Perera',
      reporterContact: undefined,
      type: 'FLOOD',
      description: 'Water is rising near the bridge',
      location: { latitude: 7.2906, longitude: 80.6337 },
      photos: [photo(1), photo(2)],
    });
    expect(result.created).toBe(true);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('accepts a report with no photo', async () => {
    const result = await service.submit(REPORTER_ID, dto, []);

    expect(storage.upload).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ photos: [] }),
    );
    expect(result.created).toBe(true);
  });

  it('returns the original report on a replay without uploading or creating anything', async () => {
    const original = entity();
    repository.findByClientRequestId.mockResolvedValue(original);

    const result = await service.submit(REPORTER_ID, dto, [file()]);

    expect(result).toEqual({ report: original, created: false });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('refuses a request id that already belongs to another reporter', async () => {
    repository.findByClientRequestId.mockResolvedValue(
      entity({ reporterId: 'someone-else' }),
    );

    await expect(
      service.submit(REPORTER_ID, dto, [file()]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('removes photos that were uploaded when a later upload fails, and stores nothing', async () => {
    storage.upload
      .mockResolvedValueOnce(photo(1))
      .mockRejectedValueOnce(new Error('cloudinary down'));

    await expect(
      service.submit(REPORTER_ID, dto, [file('a.jpg'), file('b.jpg')]),
    ).rejects.toThrow('cloudinary down');

    expect(storage.remove).toHaveBeenCalledExactlyOnceWith(photo(1).publicId);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('removes every uploaded photo when saving the report fails', async () => {
    repository.create.mockRejectedValue(new Error('atlas unreachable'));

    await expect(
      service.submit(REPORTER_ID, dto, [file('a.jpg'), file('b.jpg')]),
    ).rejects.toThrow('atlas unreachable');

    expect(storage.remove).toHaveBeenCalledTimes(2);
    expect(storage.remove).toHaveBeenCalledWith(photo(1).publicId);
    expect(storage.remove).toHaveBeenCalledWith(photo(2).publicId);
  });

  it('keeps the original error even when cleanup also fails', async () => {
    repository.create.mockRejectedValue(new Error('atlas unreachable'));
    storage.remove.mockRejectedValue(new Error('cloudinary down too'));

    await expect(service.submit(REPORTER_ID, dto, [file()])).rejects.toThrow(
      'atlas unreachable',
    );
  });

  it('discards its uploads and returns the winner when it loses a race to an identical request', async () => {
    const winner = entity({ photos: [photo(9)] });
    repository.create.mockResolvedValue({ report: winner, created: false });

    const result = await service.submit(REPORTER_ID, dto, [file()]);

    expect(result).toEqual({ report: winner, created: false });
    expect(storage.remove).toHaveBeenCalledExactlyOnceWith(photo(1).publicId);
  });

  it('refuses the race winner too if it belongs to another reporter', async () => {
    repository.create.mockResolvedValue({
      report: entity({ reporterId: 'someone-else' }),
      created: false,
    });

    await expect(
      service.submit(REPORTER_ID, dto, [file()]),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('HazardReportsService.findMine', () => {
  it("returns the reporter's own reports", async () => {
    const repository = fakeRepository();
    const reports = [entity(), entity({ id: '665f1f77bcf86cd799439012' })];
    repository.findByReporter.mockResolvedValue(reports);
    const service = new HazardReportsService(repository, fakePhotoStorage());

    expect(await service.findMine(REPORTER_ID)).toBe(reports);
    expect(repository.findByReporter).toHaveBeenCalledWith(REPORTER_ID);
  });
});
