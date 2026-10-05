import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { API_HEALTH_PATH } from '@repo/types';

import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

export const API_PREFIX = 'api';

/**
 * Shared by `main.ts` and the e2e tests so both run the same pipeline:
 * prefix, validation, and error shape.
 */
export function configureApp(app: INestApplication): void {
  // The health route already carries its full `/api/health` path (shared with
  // the web and mobile clients), so it must not be prefixed a second time.
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [{ path: API_HEALTH_PATH, method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Disaster Warning System API')
    .setDescription('Hazard reporting and verification')
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', name: 'x-officer-key', in: 'header' },
      'officer-key',
    )
    .addApiKey(
      { type: 'apiKey', name: 'x-reporter-id', in: 'header' },
      'reporter-id',
    )
    .build();
  SwaggerModule.setup(
    `${API_PREFIX}/docs`,
    app,
    SwaggerModule.createDocument(app, config),
  );
}
