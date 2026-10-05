import {
  Body,
  Controller,
  Get,
  INestApplication,
  Logger,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsInt, IsString, Min } from 'class-validator';
import request from 'supertest';

import { configureApp } from './app.setup.js';
import { HealthModule } from './health/health.module.js';

class SampleDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  count: number;
}

@Controller('samples')
class SampleController {
  @Post()
  create(@Body() dto: SampleDto): SampleDto {
    return dto;
  }

  @Get('boom')
  boom(): never {
    throw new Error('database password is hunter2');
  }
}

describe('configureApp', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
      controllers: [SampleController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves health at /api/health, not at a doubled prefix', async () => {
    const server = app.getHttpServer();

    expect((await request(server).get('/api/health')).status).toBe(200);
    expect((await request(server).get('/api/api/health')).status).toBe(404);
  });

  it('prefixes other routes with /api', async () => {
    const server = app.getHttpServer();

    const prefixed = await request(server)
      .post('/api/samples')
      .send({ name: 'a', count: 1 });
    const bare = await request(server)
      .post('/samples')
      .send({ name: 'a', count: 1 });

    expect(prefixed.status).toBe(201);
    expect(bare.status).toBe(404);
  });

  it('returns a 400 in the shared error shape for invalid bodies', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/samples')
      .send({ name: 'a', count: 0 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'count must not be less than 1',
    });
  });

  it('rejects properties the DTO does not declare', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/samples')
      .send({ name: 'a', count: 1, isAdmin: true });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('isAdmin');
  });

  it('turns unexpected errors into a generic 500', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const response = await request(app.getHttpServer()).get(
      '/api/samples/boom',
    );

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Internal server error');
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
  });
});
