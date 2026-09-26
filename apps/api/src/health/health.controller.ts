import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { API_HEALTH_PATH, type HealthResponse } from '@repo/types';

import { HealthService } from './health.service.js';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get(API_HEALTH_PATH)
  getHealth(@Res({ passthrough: true }) res: Response): HealthResponse {
    const health = this.healthService.check();
    res.status(health.status === 'ok' ? 200 : 503);
    return health;
  }
}
