import { useEffect, useState } from 'react';
import { Text } from 'react-native';

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
    return <Text accessibilityRole="alert">API unreachable</Text>;
  }

  if (!health) {
    return <Text>Checking API status…</Text>;
  }

  return <Text>{`${health.service}: ${health.status}`}</Text>;
}
