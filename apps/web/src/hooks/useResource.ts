import { useCallback, useEffect, useState } from 'react';

interface Resource<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  /** Fetches again, keeping the current data on screen until the new data arrives. */
  reload: () => void;
}

/**
 * Loads data when `deps` change and aborts the request if they change again
 * or the component goes away, so a slow old response can never overwrite a
 * newer one.
 */
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [reloadCount, setReloadCount] = useState(0);

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
    // `load` is deliberately not a dependency: callers pass an inline function.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return { data, error, loading, reload };
}
