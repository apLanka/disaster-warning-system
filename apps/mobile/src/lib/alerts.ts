import {
  DISTRICT_INFO,
  districtName,
  HAZARD_TYPE_LABELS,
  WARNING_LEVELS,
  type CitizenAlertDto,
  type District,
  type WarningLevel,
} from '@repo/types';

export const ALERTS_POLL_MS = 30_000;
export const ALERTS_CACHE_KEY = 'alerts.cache';
export const PROFILE_CACHE_KEY = 'citizen.profile';

export function activeAlerts(alerts: CitizenAlertDto[]): CitizenAlertDto[] {
  return alerts.filter((alert) => alert.state === 'ACTIVE');
}

/** Active warnings the citizen has not acknowledged: what the bell counts. */
export function unacknowledged(alerts: CitizenAlertDto[]): CitizenAlertDto[] {
  return activeAlerts(alerts).filter((alert) => alert.acknowledgedAt === null);
}

/** The most severe active level, or null when nothing is active. WARNING_LEVELS runs most to least severe. */
export function highestLevel(alerts: CitizenAlertDto[]): WarningLevel | null {
  const levels = activeAlerts(alerts).map((alert) => alert.level);
  return WARNING_LEVELS.find((level) => levels.includes(level)) ?? null;
}

export function alertTitle(alert: CitizenAlertDto): string {
  return `${HAZARD_TYPE_LABELS[alert.hazardType].toUpperCase()} WARNING`;
}

export function describeAlertDistricts(alert: CitizenAlertDto): string {
  return alert.districts.map(districtName).join(', ');
}

/** Opens the phone's maps app (or the browser) at the district centre. */
export function mapsUrl(district: District): string {
  const { latitude, longitude } = DISTRICT_INFO[district];
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** "+94771234567" as a Sri Lankan reads it: "077 123 4567". */
export function formatLocalMobile(phone: string): string {
  const digits = phone.replace(/^\+94/, '0');
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
