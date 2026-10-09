import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { fakePhotoStorage } from '../src/hazard-reports/testing/fixtures.js';
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

const fields = {
  hazardType: 'FLOOD',
  level: 'HIGH',
  districts: ['COLOMBO'],
  description: 'Heavy rainfall expected in low-lying areas',
  safetyInstructions: ['Move to higher ground immediately'],
  validUntil: new Date(Date.now() + 12 * 3600_000).toISOString(),
};

// ConfigModule validates the environment the moment AppModule is imported, so
// these must be set first. Channel failures are switched off whatever .env says.
const environment: Record<string, string | undefined> = {
  DATABASE_URL: testDatabaseUrl,
  OFFICER_API_KEY: OFFICER_KEY,
  CLOUDINARY_CLOUD_NAME: 'e2e',
  CLOUDINARY_API_KEY: 'e2e',
  CLOUDINARY_API_SECRET: 'e2e',
  SIMULATE_CHANNEL_FAILURE: '',
};

describe.skipIf(!canRunIntegration)(
  'Issue and disseminate a hazard warning (e2e, real app, dws_test)',
  () => {
    const saved: Record<string, string | undefined> = {};
    let app: INestApplication;
    let prisma: PrismaService;

    beforeAll(async () => {
      for (const [key, value] of Object.entries(environment)) {
        saved[key] = process.env[key];
        process.env[key] = value;
      }

      const { AppModule } = await import('../src/app.module.js');
      const { configureApp } = await import('../src/app.setup.js');
      const { PrismaService: Prisma } =
        await import('../src/prisma/prisma.service.js');

      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PHOTO_STORAGE)
        .useValue(fakePhotoStorage())
        .compile();
      app = moduleRef.createNestApplication();
      configureApp(app);
      await app.init();
      prisma = app.get(Prisma);
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    });

    afterAll(async () => {
      await app?.close();
      vi.restoreAllMocks();
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    beforeEach(async () => {
      await prisma.alertDelivery.deleteMany();
      await prisma.notificationLog.deleteMany();
      await prisma.hazardWarning.deleteMany();
      await prisma.citizen.deleteMany();
    });

    const http = () => request(app.getHttpServer());

    it('registers a citizen, issues a warning, delivers, acknowledges, and cancels with an All Clear', async () => {
      const register = await http()
        .put('/api/citizens/me')
        .set({ 'x-reporter-id': CITIZEN })
        .send({ district: 'COLOMBO', phone: '0771234567' });
      expect(register.status).toBe(200);

      const preview = await http()
        .post('/api/hazard-warnings/preview')
        .set(officer)
        .send({ ...fields });
      expect(preview.body.recipients).toMatchObject({ total: 1, withPhone: 1 });

      const issued = await http()
        .post('/api/hazard-warnings')
        .set(officer)
        .send({
          ...fields,
          clientRequestId: crypto.randomUUID(),
          action: 'ISSUE',
        });
      expect(issued.status).toBe(201);
      expect(issued.body.status).toBe('DISSEMINATED');
      expect(issued.body.reference).toMatch(/^HW-\d{4}-\d{4}$/);

      const mine = await http()
        .get('/api/alerts/mine')
        .set({ 'x-reporter-id': CITIZEN });
      expect(mine.body).toEqual([
        expect.objectContaining({ id: issued.body.id, state: 'ACTIVE' }),
      ]);
      const neighbour = await http()
        .get('/api/alerts/mine')
        .set({ 'x-reporter-id': NEIGHBOUR });
      expect(neighbour.body).toEqual([]);

      await http()
        .post(`/api/alerts/${issued.body.id}/acknowledge`)
        .set({ 'x-reporter-id': CITIZEN })
        .expect(200);

      const detail = await http()
        .get(`/api/hazard-warnings/${issued.body.id}`)
        .set(officer);
      expect(detail.body.acknowledged).toBe(1);
      expect(detail.body.logs).toHaveLength(3);

      await http()
        .post(`/api/hazard-warnings/${issued.body.id}/cancel`)
        .set(officer)
        .send({ reason: 'Water has receded' })
        .expect(200);

      const after = await http()
        .get('/api/alerts/mine')
        .set({ 'x-reporter-id': CITIZEN });
      expect(after.body[0]).toMatchObject({
        state: 'ALL_CLEAR',
        cancelReason: 'Water has receded',
      });
    });
    it('documents exactly the warning, citizen and alert endpoints', async () => {
      const { createApiDocument } = await import('../src/app.setup.js');
      const document = createApiDocument(app);
      const documented = Object.entries(document.paths)
        .flatMap(([path, item]) =>
          Object.keys(item)
            .filter((method) =>
              ['get', 'post', 'patch', 'put', 'delete'].includes(method),
            )
            .map((method) => `${method.toUpperCase()} ${path}`),
        )
        .filter((entry) =>
          /^\w+ \/api\/(hazard-warnings|citizens|alerts)(\/|$)/.test(entry),
        );

      expect(documented.sort()).toEqual(
        [
          'POST /api/hazard-warnings/preview',
          'GET /api/hazard-warnings/stats',
          'GET /api/hazard-warnings/prefill',
          'GET /api/hazard-warnings',
          'POST /api/hazard-warnings',
          'GET /api/hazard-warnings/{id}',
          'PATCH /api/hazard-warnings/{id}',
          'DELETE /api/hazard-warnings/{id}',
          'POST /api/hazard-warnings/{id}/issue',
          'POST /api/hazard-warnings/{id}/retry',
          'POST /api/hazard-warnings/{id}/cancel',
          'PUT /api/citizens/me',
          'GET /api/citizens/me',
          'GET /api/alerts/mine',
          'POST /api/alerts/{warningId}/acknowledge',
        ].sort(),
      );
    });
  },
);
