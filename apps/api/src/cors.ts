import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const DEFAULT_WEB_ORIGIN = 'http://localhost:5173';

export const corsOptions: CorsOptions = {
  origin: process.env.CORS_ORIGIN ?? DEFAULT_WEB_ORIGIN,
};
