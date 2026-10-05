export const API_HEALTH_PATH = '/api/health' as const;

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
}
