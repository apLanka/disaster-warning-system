import { Inject, Injectable, Optional } from '@nestjs/common';

import type { HealthResponse } from '@repo/types';

export const SERVICE_NAME = 'api';

export const HEALTH_PROBE = Symbol('HEALTH_PROBE');

@Injectable()
export class HealthService {
  private readonly probe: () => boolean;

  constructor(@Optional() @Inject(HEALTH_PROBE) probe?: () => boolean) {
    this.probe = probe ?? (() => true);
  }

  check(): HealthResponse {
    return {
      status: this.probe() ? 'ok' : 'degraded',
      service: SERVICE_NAME,
      timestamp: new Date().toISOString(),
    };
  }
}
