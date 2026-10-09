const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const absolute = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

/** Relative for the last day ("2 mins ago"), a full date after that. */
export function formatRelativeTime(iso: string, now = new Date()): string {
  const elapsed = Math.max(0, now.getTime() - new Date(iso).getTime());
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return plural(Math.floor(elapsed / MINUTE), 'min');
  if (elapsed < DAY) return plural(Math.floor(elapsed / HOUR), 'hr');
  return absolute.format(new Date(iso)).replace(' at ', ', ');
}

/** Always the full date and time, e.g. "7 Oct 2026, 14:30" (Sri Lanka time). */
export function formatDateTime(iso: string): string {
  return absolute.format(new Date(iso)).replace(' at ', ', ');
}
