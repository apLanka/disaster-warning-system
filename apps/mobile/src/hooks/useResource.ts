import { useCallback, useEffect, useState } from 'react';

interface Resource<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads data when `deps` change and aborts if they change again or the screen
 * goes away, so a slow old response can never overwrite a newer one. Data
 * already on screen stays there while a reload runs.
 */
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    load(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // `load` is an inline function from the caller, so only `deps` drive reloads.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, count]);

  const reload = useCallback(() => setCount((n) => n + 1), []);
  return { data, error, loading, reload };
}
