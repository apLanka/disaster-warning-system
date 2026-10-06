import type { GeoLocation } from '@repo/types';

/** Decimal degrees with four decimals and hemisphere letters: 7.2906° N, 80.6337° E. */
export function formatCoordinates({
  latitude,
  longitude,
}: GeoLocation): string {
  const lat = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}
