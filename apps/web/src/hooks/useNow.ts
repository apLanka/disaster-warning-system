import { useEffect, useState } from 'react';

const ONE_MINUTE = 60_000;

/** The current time, refreshed every minute so "2 mins ago" does not go stale on screen. */
export function useNow(intervalMs = ONE_MINUTE): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
