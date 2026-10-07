import type { GeoLocation } from '@repo/types';

const TIME_ZONE = 'Asia/Colombo';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Reports waiting longer than this are highlighted as needing attention. */
export const STALE_AFTER_MINUTES = 30;

const absolute = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const timeOnly = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

/** Relative for the last day ("2 mins ago"), absolute after that ("5 Oct 2026, 06:35"). */
export function formatRelativeTime(iso: string, now = new Date()): string {
  const elapsed = Math.max(0, now.getTime() - new Date(iso).getTime());

  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return plural(Math.floor(elapsed / MINUTE), 'min');
  if (elapsed < DAY) return plural(Math.floor(elapsed / HOUR), 'hr');
  return absolute.format(new Date(iso)).replace(' at ', ', ');
}

/** "Today, 06:35 AM" for today in Sri Lanka, otherwise the absolute date and time. */
export function formatIncidentTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (dayKey.format(date) === dayKey.format(now)) {
    return `Today, ${timeOnly.format(date).toUpperCase()}`;
  }
  return absolute.format(date).replace(' at ', ', ');
}

export function minutesSince(iso: string, now = new Date()): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / MINUTE);
}

export function isStale(iso: string, now = new Date()): boolean {
  return minutesSince(iso, now) > STALE_AFTER_MINUTES;
}

/** Decimal degrees with four decimals and hemisphere letters: 7.2906° N, 80.6337° E. */
export function formatCoordinates({
  latitude,
  longitude,
}: GeoLocation): string {
  const lat = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "14:31" in Sri Lanka time, for activity feeds. */
export function formatClock(iso: string): string {
  return clock.format(new Date(iso));
}
