import { useEffect, useState } from 'react';

import type { HealthResponse } from '@repo/types';

import { fetchHealth } from '../api/health';

export function HealthStatus() {
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
      <p role="alert" className="text-red-600">
        API unreachable
      </p>
    );
  }

  if (!health) {
    return <p className="text-slate-500">Checking API status…</p>;
  }

  return (
    <p
      className={
        health.status === 'ok' ? 'text-green-700' : 'text-amber-700'
      }
    >
      {health.service}: {health.status}
    </p>
  );
}
