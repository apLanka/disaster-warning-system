import type { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: integration suites skip themselves.
}

export const testDatabaseUrl = process.env['DATABASE_URL_TEST'];

/**
 * Integration suites delete whole collections, so they only run against a
 * database whose name contains "test" and never against dev data.
 */
export const canRunIntegration =
  testDatabaseUrl !== undefined &&
  /\/[^/?]*test[^/?]*(\?|$)/i.test(testDatabaseUrl);

export function createTestPrisma(): PrismaService {
  const config = {
    get: () => testDatabaseUrl,
  } as unknown as ConfigService<Env, true>;
  return new PrismaService(config);
}
