import {
  BadGatewayException,
  Logger,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import type {
  HazardReportDto,
  NotificationDto,
  Paginated,
  ReportStats,
} from '@repo/types';

import {
  fakePhotoStorage,
  JPEG,
} from '../src/hazard-reports/testing/fixtures.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { PHOTO_STORAGE } from '../src/storage/photo-storage.js';
import {
  canRunIntegration,
  testDatabaseUrl,
} from '../src/testing/integration.js';

const OFFICER_KEY = 'e2e-officer-key-0123456789';
const CITIZEN = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const NEIGHBOUR = '11111111-2222-4333-8444-555555555555';
const officer = {
  'x-officer-key': OFFICER_KEY,
  'x-officer-name': 'Officer Silva',
};

// ConfigModule validates the environment the moment AppModule is imported, so
// these must be set first. Real credentials are overwritten with dummies: the
// photo storage is faked and nothing here may reach Cloudinary.
const environment: Record<string, string | undefined> = {
  DATABASE_URL: testDatabaseUrl,
  OFFICER_API_KEY: OFFICER_KEY,
  CLOUDINARY_CLOUD_NAME: 'e2e',
  CLOUDINARY_API_KEY: 'e2e',
  CLOUDINARY_API_SECRET: 'e2e',
};

describe.skipIf(!canRunIntegration)(
  'Submit and verify a hazard report (e2e, real app, dws_test)',
  () => {
    const saved: Record<string, string | undefined> = {};
    let app: INestApplication;
    let prisma: PrismaService;
    let storage: ReturnType<typeof fakePhotoStorage>;

    beforeAll(async () => {
      for (const [key, value] of Object.entries(environment)) {
        saved[key] = process.env[key];
        process.env[key] = value;
      }

      const { AppModule } = await import('../src/app.module.js');
      const { configureApp } = await import('../src/app.setup.js');
      const { PrismaService: Prisma } =
        await import('../src/prisma/prisma.service.js');

      storage = fakePhotoStorage();
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PHOTO_STORAGE)
        .useValue(storage)
        .compile();
      app = moduleRef.createNestApplication();
      configureApp(app);
      await app.init();
      prisma = app.get(Prisma);
    });

    afterAll(async () => {
      await app?.close();
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    beforeEach(async () => {
      await prisma.hazardReport.deleteMany();
      await prisma.notification.deleteMany();
      await prisma.counter.deleteMany();
      storage.upload.mockClear();
      storage.remove.mockClear();
    });

    const http = () => request(app.getHttpServer());

    function submit(
      options: { reporter?: string; requestId?: string; photos?: number } = {},
    ) {
      const req = http()
        .post('/api/hazard-reports')
        .set('x-reporter-id', options.reporter ?? CITIZEN)
        .field('clientRequestId', options.requestId ?? crypto.randomUUID())
        .field('type', 'FLOOD')
        .field('description', 'E2E: water is rising near the bridge')
        .field('latitude', '7.2906')
        .field('longitude', '80.6337');
      for (let i = 0; i < (options.photos ?? 0); i++) {
        req.attach('photos', JPEG, {
          filename: `${i}.jpg`,
          contentType: 'image/jpeg',
        });
      }
      return req;
    }

    async function submitOne(options: Parameters<typeof submit>[0] = {}) {
      const response = await submit(options);
      expect(response.status).toBe(201);
      return response.body as HazardReportDto;
    }

    it('runs against the test database, never dev data', () => {
      expect(process.env['DATABASE_URL']).toBe(testDatabaseUrl);
      expect(testDatabaseUrl).toMatch(/test/i);
    });

    it('takes a report from submission to a verified notification', async () => {
      // Citizen submits with two photos.
      const created = await submit({ photos: 2 });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        status: 'PENDING_VERIFICATION',
        reference: expect.stringMatching(/^HR-\d{4}-0001$/),
      });
      expect(created.body.photos).toHaveLength(2);
      expect(storage.upload).toHaveBeenCalledTimes(2);
      const id: string = created.body.id;

      // It shows up for the officer as pending.
      const stats = await http().get('/api/hazard-reports/stats').set(officer);
      expect(stats.body).toEqual({
        pending: 1,
        verifiedToday: 0,
        rejected: 0,
        total: 1,
      });
      const pending = await http()
        .get('/api/hazard-reports')
        .query({ status: 'PENDING_VERIFICATION' })
        .set(officer);
      expect(
        (pending.body as Paginated<HazardReportDto>).items.map((r) => r.id),
      ).toEqual([id]);

      // The officer verifies it.
      const verified = await http()
        .patch(`/api/hazard-reports/${id}/verify`)
        .set(officer)
        .send({ notes: 'INTERNAL matches the gauge' });
      expect(verified.status).toBe(200);
      expect(verified.body.status).toBe('VERIFIED');
      expect(verified.body.decision.decidedBy).toBe('Officer Silva');

      // The citizen sees the outcome, without the officer's details.
      const mine = await http()
        .get('/api/hazard-reports/mine')
        .set('x-reporter-id', CITIZEN);
      expect(mine.body[0].status).toBe('VERIFIED');
      expect(JSON.stringify(mine.body)).not.toMatch(/Silva|INTERNAL/);

      // And is notified, then reads it.
      const inbox = await http()
        .get('/api/notifications')
        .set('x-reporter-id', CITIZEN);
      const [note] = inbox.body as NotificationDto[];
      expect(inbox.body).toHaveLength(1);
      expect(note).toMatchObject({
        kind: 'REPORT_VERIFIED',
        reportId: id,
        readAt: null,
      });
      expect(note?.message).toContain(created.body.reference);
      expect(JSON.stringify(inbox.body)).not.toMatch(/Silva|INTERNAL/);

      const read = await http()
        .patch(`/api/notifications/${note?.id}/read`)
        .set('x-reporter-id', CITIZEN);
      expect(read.body.readAt).toEqual(expect.any(String));
      const unread = await http()
        .get('/api/notifications')
        .query({ unread: 'true' })
        .set('x-reporter-id', CITIZEN);
      expect(unread.body).toEqual([]);

      // The officer's numbers moved.
      const after = await http().get('/api/hazard-reports/stats').set(officer);
      expect(after.body).toEqual({
        pending: 0,
        verifiedToday: 1,
        rejected: 0,
        total: 1,
      });
    });

    it('rejects a report with a reason the citizen can read, and decides only once', async () => {
      const { id } = await submitOne();

      const rejected = await http()
        .patch(`/api/hazard-reports/${id}/reject`)
        .set(officer)
        .send({
          reason: 'INSUFFICIENT_INFORMATION',
          details: 'Please add a photo',
          notes: 'INTERNAL vague',
        });
      expect(rejected.status).toBe(200);

      const inbox = await http()
        .get('/api/notifications')
        .set('x-reporter-id', CITIZEN);
      expect(inbox.body[0]).toMatchObject({ kind: 'REPORT_REJECTED' });
      expect(inbox.body[0].message).toContain(
        'Reason: Insufficient information.',
      );
      expect(inbox.body[0].message).toContain('Please add a photo');
      expect(JSON.stringify(inbox.body)).not.toMatch(/Silva|INTERNAL/);

      const again = await http()
        .patch(`/api/hazard-reports/${id}/verify`)
        .set(officer);
      expect(again.status).toBe(409);
      expect(
        (await http().get(`/api/hazard-reports/${id}`).set(officer)).body
          .status,
      ).toBe('REJECTED');
      expect(
        (await http().get('/api/notifications').set('x-reporter-id', CITIZEN))
          .body,
      ).toHaveLength(1);
    });

    it('refuses to reject for OTHER without details, leaving the report pending', async () => {
      const { id } = await submitOne();

      const response = await http()
        .patch(`/api/hazard-reports/${id}/reject`)
        .set(officer)
        .send({ reason: 'OTHER' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'details is required when reason is OTHER',
      );
      expect(
        (await http().get(`/api/hazard-reports/${id}`).set(officer)).body
          .status,
      ).toBe('PENDING_VERIFICATION');
    });

    it('lets exactly one of two simultaneous decisions win, and notifies once', async () => {
      const { id } = await submitOne();

      const [a, b] = await Promise.all([
        http().patch(`/api/hazard-reports/${id}/verify`).set(officer),
        http()
          .patch(`/api/hazard-reports/${id}/reject`)
          .set(officer)
          .send({ reason: 'DUPLICATE' }),
      ]);

      expect([a.status, b.status].sort((x, y) => x - y)).toEqual([200, 409]);
      expect(await prisma.notification.count()).toBe(1);
    });

    it('treats a replayed submission as the same report, without uploading again', async () => {
      const requestId = crypto.randomUUID();
      const first = await submit({ requestId, photos: 1 });
      storage.upload.mockClear();

      const replay = await submit({ requestId, photos: 1 });

      expect(first.status).toBe(201);
      expect(replay.status).toBe(200);
      expect(replay.body.id).toBe(first.body.id);
      expect(storage.upload).not.toHaveBeenCalled();
      expect(await prisma.hazardReport.count()).toBe(1);
    });

    it('stores nothing and answers 502 when the photo upload fails', async () => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      storage.upload.mockRejectedValueOnce(
        new BadGatewayException('Photo upload failed. Please try again.'),
      );

      const response = await submit({ photos: 1 });

      expect(response.status).toBe(502);
      expect(response.body.error).toBe('Bad Gateway');
      expect(await prisma.hazardReport.count()).toBe(0);
    });

    it('keeps officer routes closed to anyone without the key', async () => {
      const { id } = await submitOne();

      for (const [method, path] of [
        ['get', '/api/hazard-reports'],
        ['get', '/api/hazard-reports/stats'],
        ['patch', `/api/hazard-reports/${id}/verify`],
      ] as const) {
        expect((await http()[method](path)).status).toBe(401);
        expect(
          (await http()[method](path).set('x-reporter-id', CITIZEN)).status,
        ).toBe(401);
        expect(
          (await http()[method](path).set('x-officer-key', 'wrong')).status,
        ).toBe(401);
      }
      expect(
        (await http().get(`/api/hazard-reports/${id}`).set(officer)).body
          .status,
      ).toBe('PENDING_VERIFICATION');
    });

    it("keeps one citizen's reports and notifications away from another", async () => {
      const { id } = await submitOne();
      await http().patch(`/api/hazard-reports/${id}/verify`).set(officer);
      const [note] = (
        await http().get('/api/notifications').set('x-reporter-id', CITIZEN)
      ).body as NotificationDto[];

      const theirs = { 'x-reporter-id': NEIGHBOUR };
      expect(
        (await http().get(`/api/hazard-reports/${id}`).set(theirs)).status,
      ).toBe(404);
      expect(
        (await http().get('/api/hazard-reports/mine').set(theirs)).body,
      ).toEqual([]);
      expect((await http().get('/api/notifications').set(theirs)).body).toEqual(
        [],
      );
      expect(
        (await http().patch(`/api/notifications/${note?.id}/read`).set(theirs))
          .status,
      ).toBe(404);
      expect(
        (
          await http()
            .get('/api/notifications')
            .query({ unread: 'true' })
            .set('x-reporter-id', CITIZEN)
        ).body,
      ).toHaveLength(1);
    });

    it('lists, filters, sorts, and pages for the officer', async () => {
      const first = await submitOne();
      const second = await submitOne();
      await submitOne({ reporter: NEIGHBOUR });
      await http().patch(`/api/hazard-reports/${first.id}/verify`).set(officer);

      const pendingOldest = await http()
        .get('/api/hazard-reports')
        .query({ status: 'PENDING_VERIFICATION', sort: 'oldest' })
        .set(officer);
      const body = pendingOldest.body as Paginated<HazardReportDto>;
      expect(body.total).toBe(2);
      expect(body.items[0]?.id).toBe(second.id);

      const page = await http()
        .get('/api/hazard-reports')
        .query({ limit: '2', page: '2', sort: 'newest' })
        .set(officer);
      expect((page.body as Paginated<HazardReportDto>).items).toHaveLength(1);
      expect((page.body as Paginated<HazardReportDto>).total).toBe(3);

      const stats = (await http().get('/api/hazard-reports/stats').set(officer))
        .body as ReportStats;
      expect(stats).toEqual({
        pending: 2,
        verifiedToday: 1,
        rejected: 0,
        total: 3,
      });
    });

    it('serves the health check at /api/health', async () => {
      expect((await http().get('/api/health')).status).toBe(200);
    });

    it('documents exactly the endpoints in the plan', async () => {
      const { createApiDocument } = await import('../src/app.setup.js');
      const document = createApiDocument(app);

      const documented = Object.entries(document.paths).flatMap(
        ([path, item]) =>
          Object.keys(item)
            .filter((method) =>
              ['get', 'post', 'patch', 'put', 'delete'].includes(method),
            )
            .map((method) => `${method.toUpperCase()} ${path}`),
      );
      // Other use cases document their own routes in their own e2e suites.
      const ours = documented.filter((entry) =>
        /^\w+ \/api\/(health|hazard-reports|notifications)(\/|$)/.test(entry),
      );

      expect(ours.sort()).toEqual(
        [
          'GET /api/health',
          'POST /api/hazard-reports',
          'GET /api/hazard-reports',
          'GET /api/hazard-reports/mine',
          'GET /api/hazard-reports/stats',
          'GET /api/hazard-reports/{id}',
          'PATCH /api/hazard-reports/{id}/verify',
          'PATCH /api/hazard-reports/{id}/reject',
          'GET /api/notifications',
          'PATCH /api/notifications/{id}/read',
        ].sort(),
      );
    });
  },
);
