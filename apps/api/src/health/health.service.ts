import { Injectable } from '@nestjs/common';

import type { HealthResponse } from '@repo/types';

export const SERVICE_NAME = 'api';

@Injectable()
export class HealthService {
  constructor(private readonly probe: () => boolean = () => true) {}

  check(): HealthResponse {
    return {
      status: this.probe() ? 'ok' : 'degraded',
      service: SERVICE_NAME,
      timestamp: new Date().toISOString(),
    };
  }
}
