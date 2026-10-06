import { useEffect, useState } from 'react';

import type { HealthResponse } from '@repo/types';

import { fetchHealth } from '../api/health';

// Status text colours per surface: the brand red and green are too dark on navy.
const TONES = {
  light: {
    error: 'text-danger',
    loading: 'text-muted',
    ok: 'text-success',
    degraded: 'text-warning-text',
  },
  dark: {
    error: 'text-danger-tint',
    loading: 'text-white/70',
    ok: 'text-white',
    degraded: 'text-warning-tint',
  },
};

export function HealthStatus({
  surface = 'light',
}: {
  surface?: 'light' | 'dark';
}) {
  const tone = TONES[surface];
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchHealth(controller.signal)
      .then(setHealth)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause : new Error(String(cause)));
        }
      });

    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <p role="alert" className={tone.error}>
        API unreachable
      </p>
    );
  }

  if (!health) {
    return <p className={tone.loading}>Checking API status…</p>;
  }

  return (
    <p className={health.status === 'ok' ? tone.ok : tone.degraded}>
      {health.service}: {health.status}
    </p>
  );
}
