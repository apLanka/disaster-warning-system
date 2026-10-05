import { BadGatewayException, INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { HAZARD_REPORT_LIMITS } from '@repo/types';

import { configureApp } from '../app.setup.js';
import { PHOTO_STORAGE } from '../storage/photo-storage.js';
import { HAZARD_REPORT_REPOSITORY } from './hazard-report.repository.js';
import { HazardReportsController } from './hazard-reports.controller.js';
import { HazardReportsService } from './hazard-reports.service.js';
import {
  CLIENT_REQUEST_ID,
  entity,
  fakePhotoStorage,
  fakeRepository,
  JPEG,
  NOT_AN_IMAGE,
  photo,
  REPORTER_ID,
} from './testing/fixtures.js';

const fields = {
  clientRequestId: CLIENT_REQUEST_ID,
  type: 'FLOOD',
  description: 'Water is rising near the bridge',
  latitude: '7.2906',
  longitude: '80.6337',
};

describe('HazardReportsController', () => {
  let app: INestApplication;
  let repository: ReturnType<typeof fakeRepository>;
  let storage: ReturnType<typeof fakePhotoStorage>;

  beforeEach(async () => {
    repository = fakeRepository();
    storage = fakePhotoStorage();
    repository.findByClientRequestId.mockResolvedValue(null);
    repository.create.mockImplementation(async (input) => ({
      report: entity({ ...input, photos: input.photos }),
      created: true,
    }));
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const moduleRef = await Test.createTestingModule({
      controllers: [HazardReportsController],
      providers: [
        HazardReportsService,
        { provide: HAZARD_REPORT_REPOSITORY, useValue: repository },
        { provide: PHOTO_STORAGE, useValue: storage },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  /** A submit request carrying all the valid text fields, ready to be overridden. */
  function submit(
    overrides: Record<string, string> = {},
    reporterId = REPORTER_ID,
  ) {
    const req = request(app.getHttpServer()).post('/api/hazard-reports');
    if (reporterId) req.set('x-reporter-id', reporterId);
    for (const [name, value] of Object.entries({ ...fields, ...overrides })) {
      req.field(name, value);
    }
    return req;
  }

  describe('POST /api/hazard-reports', () => {
    it('creates a report with a photo and returns 201', async () => {
      const response = await submit().attach('photos', JPEG, {
        filename: 'flood.jpg',
        contentType: 'image/jpeg',
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        reference: 'HR-2026-0001',
        status: 'PENDING_VERIFICATION',
        type: 'FLOOD',
        location: { latitude: 7.2906, longitude: 80.6337 },
        photos: [photo(1)],
      });
      expect(response.body).not.toHaveProperty('clientRequestId');
      expect(storage.upload).toHaveBeenCalledOnce();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ reporterId: REPORTER_ID }),
      );
    });

    it('accepts a report without a photo', async () => {
      const response = await submit();

      expect(response.status).toBe(201);
      expect(response.body.photos).toEqual([]);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('returns 200 and the original report when the request is replayed', async () => {
      repository.findByClientRequestId.mockResolvedValue(entity());

      const response = await submit().attach('photos', JPEG, {
        filename: 'flood.jpg',
        contentType: 'image/jpeg',
      });

      expect(response.status).toBe(200);
      expect(response.body.reference).toBe('HR-2026-0001');
      expect(storage.upload).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('accepts the maximum number of photos', async () => {
      const req = submit();
      for (let i = 0; i < HAZARD_REPORT_LIMITS.photosMax; i++) {
        req.attach('photos', JPEG, {
          filename: `${i}.jpg`,
          contentType: 'image/jpeg',
        });
      }

      expect((await req).status).toBe(201);
      expect(storage.upload).toHaveBeenCalledTimes(
        HAZARD_REPORT_LIMITS.photosMax,
      );
    });

    it.each([
      ['a missing description', { description: '' }, /description/],
      ['a too-short description', { description: 'short' }, /description/],
      ['an unknown hazard type', { type: 'TORNADO' }, /type/],
      ['a latitude out of range', { latitude: '95' }, /latitude/],
      ['a non-numeric longitude', { longitude: 'east' }, /longitude/],
      [
        'a malformed clientRequestId',
        { clientRequestId: 'abc' },
        /clientRequestId/,
      ],
    ])(
      'rejects %s with 400 and stores nothing',
      async (_name, overrides, message) => {
        const response = await submit(overrides).attach('photos', JPEG, {
          filename: 'flood.jpg',
          contentType: 'image/jpeg',
        });

        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(message);
        expect(storage.upload).not.toHaveBeenCalled();
        expect(repository.create).not.toHaveBeenCalled();
      },
    );

    it('rejects a client trying to set the status itself', async () => {
      const response = await submit({ status: 'VERIFIED' });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/status/);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a request with no reporter id', async () => {
      const response = await submit({}, '');

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/x-reporter-id/);
    });

    it('rejects a file declared as a non-image with 415', async () => {
      const response = await submit().attach('photos', Buffer.from('hello'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

      expect(response.status).toBe(415);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects a non-image disguised with an image mimetype with 415', async () => {
      const response = await submit().attach('photos', NOT_AN_IMAGE, {
        filename: 'sneaky.jpg',
        contentType: 'image/jpeg',
      });

      expect(response.status).toBe(415);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects a photo over the size limit with 413', async () => {
      const tooBig = Buffer.concat([
        JPEG,
        Buffer.alloc(HAZARD_REPORT_LIMITS.photoMaxBytes + 1),
      ]);

      const response = await submit().attach('photos', tooBig, {
        filename: 'huge.jpg',
        contentType: 'image/jpeg',
      });

      expect(response.status).toBe(413);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects more photos than allowed with 400', async () => {
      const req = submit();
      for (let i = 0; i <= HAZARD_REPORT_LIMITS.photosMax; i++) {
        req.attach('photos', JPEG, {
          filename: `${i}.jpg`,
          contentType: 'image/jpeg',
        });
      }

      const response = await req;

      expect(response.status).toBe(400);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('returns 502 and stores no report when the photo upload fails', async () => {
      storage.upload.mockRejectedValue(
        new BadGatewayException('Photo upload failed'),
      );

      const response = await submit().attach('photos', JPEG, {
        filename: 'flood.jpg',
        contentType: 'image/jpeg',
      });

      expect(response.status).toBe(502);
      expect(response.body.error).toBe('Bad Gateway');
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('returns a generic 500 when the database fails, and removes the uploaded photo', async () => {
      repository.create.mockRejectedValue(
        new Error('mongodb+srv://secret@host'),
      );

      const response = await submit().attach('photos', JPEG, {
        filename: 'flood.jpg',
        contentType: 'image/jpeg',
      });

      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain('secret');
      expect(storage.remove).toHaveBeenCalledWith(photo(1).publicId);
    });
  });

  describe('GET /api/hazard-reports/mine', () => {
    it("lists the caller's own reports", async () => {
      repository.findByReporter.mockResolvedValue([
        entity(),
        entity({ id: '665f1f77bcf86cd799439012', reference: 'HR-2026-0002' }),
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/hazard-reports/mine')
        .set('x-reporter-id', REPORTER_ID);

      expect(response.status).toBe(200);
      expect(
        response.body.map((r: { reference: string }) => r.reference),
      ).toEqual(['HR-2026-0001', 'HR-2026-0002']);
      expect(repository.findByReporter).toHaveBeenCalledWith(REPORTER_ID);
    });

    it('returns an empty list for a reporter with no reports', async () => {
      repository.findByReporter.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/api/hazard-reports/mine')
        .set('x-reporter-id', REPORTER_ID);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('requires the reporter id header', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/hazard-reports/mine',
      );

      expect(response.status).toBe(400);
      expect(repository.findByReporter).not.toHaveBeenCalled();
    });
  });
});
