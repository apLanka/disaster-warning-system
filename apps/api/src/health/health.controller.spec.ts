import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import type { HealthResponse } from '@repo/types';

import { corsOptions, DEFAULT_WEB_ORIGIN } from '../cors.js';
import { HealthModule } from './health.module.js';
import { HealthService } from './health.service.js';

async function createApp(probe?: () => boolean): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [HealthModule],
  })
    .overrideProvider(HealthService)
    .useValue(new HealthService(probe))
    .compile();

  const app = moduleRef.createNestApplication();
  app.enableCors(corsOptions);
  await app.init();
  return app;
}

// Builds the module with no provider override, so Nest's own dependency
// injection has to resolve HealthService the same way it does at runtime.
async function createAppWired(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [HealthModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('HealthController', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('starts with the real module wiring and no provider override', async () => {
    app = await createAppWired();

    const response = await request(app.getHttpServer()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('returns 200 and an ok HealthResponse when the probe passes', async () => {
    app = await createApp(() => true);

    const response = await request(app.getHttpServer()).get('/api/health');

    expect(response.status).toBe(200);
    const body: HealthResponse = response.body;
    expect(body.status).toBe('ok');
    expect(body.service).toBe('api');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it('returns 503 and a degraded HealthResponse when the probe fails', async () => {
    app = await createApp(() => false);

    const response = await request(app.getHttpServer()).get('/api/health');

    expect(response.status).toBe(503);
    const body: HealthResponse = response.body;
    expect(body.status).toBe('degraded');
  });

  it('allows the configured web origin', async () => {
    app = await createApp(() => true);

    const response = await request(app.getHttpServer())
      .options('/api/health')
      .set('Origin', DEFAULT_WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-allow-origin']).toBe(
      DEFAULT_WEB_ORIGIN,
    );
  });

  it('never echoes an unrecognised requesting origin', async () => {
    app = await createApp(() => true);

    const response = await request(app.getHttpServer())
      .options('/api/health')
      .set('Origin', 'http://evil.example')
      .set('Access-Control-Request-Method', 'GET');

    // The server advertises its configured origin unconditionally; the browser
    // is what compares it against the requesting origin. The invariant worth
    // pinning is that the server never reflects the requester's origin, which
    // is what would make it wide open.
    expect(response.headers['access-control-allow-origin']).not.toBe(
      'http://evil.example',
    );
  });
});
