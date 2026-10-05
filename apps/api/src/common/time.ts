const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Midnight at the start of the given moment's day in Sri Lanka (UTC+05:30, no
 * daylight saving), as an absolute instant. "Verified today" means this day.
 */
export function startOfColomboDay(now: Date): Date {
  const local = now.getTime() + COLOMBO_OFFSET_MS;
  const localMidnight = local - (((local % DAY_MS) + DAY_MS) % DAY_MS);
  return new Date(localMidnight - COLOMBO_OFFSET_MS);
}
