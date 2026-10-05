import { ConflictException, Logger, NotFoundException } from '@nestjs/common';

import type { PhotoUpload } from '../storage/photo-storage.js';
import type { CreateHazardReportDto } from './dto/create-hazard-report.dto.js';
import { HazardReportsService } from './hazard-reports.service.js';
import {
  CLIENT_REQUEST_ID,
  decided,
  entity,
  fakeNotifier,
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
    service = new HazardReportsService(repository, storage, fakeNotifier());
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
    const service = new HazardReportsService(
      repository,
      fakePhotoStorage(),
      fakeNotifier(),
    );

    expect(await service.findMine(REPORTER_ID)).toBe(reports);
    expect(repository.findByReporter).toHaveBeenCalledWith(REPORTER_ID);
  });
});

describe('HazardReportsService (officer use cases)', () => {
  let repository: ReturnType<typeof fakeRepository>;
  let notifier: ReturnType<typeof fakeNotifier>;
  let errorLog: ReturnType<typeof vi.spyOn>;
  let service: HazardReportsService;

  beforeEach(() => {
    repository = fakeRepository();
    notifier = fakeNotifier();
    service = new HazardReportsService(
      repository,
      fakePhotoStorage(),
      notifier,
    );
    errorLog = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('list and stats', () => {
    it('passes the query straight to the repository', async () => {
      const page = { items: [entity()], total: 1, page: 1, limit: 20 };
      repository.list.mockResolvedValue(page);
      const query = { sort: 'oldest', page: 1, limit: 20 } as const;

      expect(await service.list(query)).toBe(page);
      expect(repository.list).toHaveBeenCalledWith(query);
    });

    it('counts "verified today" from the start of the day in Sri Lanka', async () => {
      const stats = { pending: 2, verifiedToday: 1, rejected: 0, total: 3 };
      repository.stats.mockResolvedValue(stats);

      const result = await service.stats(new Date('2026-10-05T10:00:00.000Z'));

      expect(result).toBe(stats);
      expect(repository.stats).toHaveBeenCalledWith(
        new Date('2026-10-04T18:30:00.000Z'),
      );
    });
  });

  describe('findOne', () => {
    const officer = { kind: 'officer', name: 'Officer Silva' } as const;

    it('shows an officer any report', async () => {
      repository.findById.mockResolvedValue(entity({ reporterId: 'anyone' }));

      expect((await service.findOne('id', officer)).reporterId).toBe('anyone');
    });

    it('shows a reporter their own report', async () => {
      repository.findById.mockResolvedValue(entity());

      const report = await service.findOne('id', {
        kind: 'reporter',
        reporterId: REPORTER_ID,
      });

      expect(report.reporterId).toBe(REPORTER_ID);
    });

    it("says not found, not forbidden, for someone else's report", async () => {
      repository.findById.mockResolvedValue(entity());

      await expect(
        service.findOne('id', { kind: 'reporter', reporterId: 'someone-else' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('says not found for an unknown id', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('id', officer)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('verify', () => {
    it('verifies, records who and their notes, and notifies the reporter', async () => {
      const report = decided('VERIFIED');
      repository.decide.mockResolvedValue({ outcome: 'DECIDED', report });

      const result = await service.verify('id', 'Officer Silva', {
        notes: 'Checked',
      });

      expect(repository.decide).toHaveBeenCalledWith('id', {
        status: 'VERIFIED',
        decidedBy: 'Officer Silva',
        officerNotes: 'Checked',
      });
      expect(notifier.notifyDecision).toHaveBeenCalledExactlyOnceWith(report);
      expect(result).toBe(report);
    });
  });

  describe('reject', () => {
    it('rejects with the reason and details, and notifies the reporter', async () => {
      const report = decided('REJECTED');
      repository.decide.mockResolvedValue({ outcome: 'DECIDED', report });

      const result = await service.reject('id', 'Officer Silva', {
        reason: 'OTHER',
        details: 'Different location',
        notes: 'Map does not match',
      });

      expect(repository.decide).toHaveBeenCalledWith('id', {
        status: 'REJECTED',
        decidedBy: 'Officer Silva',
        officerNotes: 'Map does not match',
        rejectionReason: 'OTHER',
        rejectionDetails: 'Different location',
      });
      expect(notifier.notifyDecision).toHaveBeenCalledExactlyOnceWith(report);
      expect(result).toBe(report);
    });
  });

  describe.each([
    ['verify', () => service.verify('id', 'Officer', {})],
    ['reject', () => service.reject('id', 'Officer', { reason: 'DUPLICATE' })],
  ])('%s edge cases', (_name, act) => {
    it('says 409 when the report was already decided, and notifies no one', async () => {
      repository.decide.mockResolvedValue({ outcome: 'ALREADY_DECIDED' });

      await expect(act()).rejects.toBeInstanceOf(ConflictException);
      expect(notifier.notifyDecision).not.toHaveBeenCalled();
    });

    it('says 404 for an unknown report, and notifies no one', async () => {
      repository.decide.mockResolvedValue({ outcome: 'NOT_FOUND' });

      await expect(act()).rejects.toBeInstanceOf(NotFoundException);
      expect(notifier.notifyDecision).not.toHaveBeenCalled();
    });

    it('still succeeds when the notification fails, because the decision is already stored', async () => {
      const report = decided('VERIFIED');
      repository.decide.mockResolvedValue({ outcome: 'DECIDED', report });
      notifier.notifyDecision.mockRejectedValue(new Error('notifier down'));

      await expect(act()).resolves.toBe(report);
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringContaining('notifier down'),
      );
    });

    it('does not swallow a repository failure', async () => {
      repository.decide.mockRejectedValue(new Error('atlas unreachable'));

      await expect(act()).rejects.toThrow('atlas unreachable');
      expect(notifier.notifyDecision).not.toHaveBeenCalled();
    });
  });
});
