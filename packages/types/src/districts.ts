import type { GeoLocation } from './hazard-report.js';

/** Sri Lanka's 25 administrative districts. Codes are stored; names are shown. */
export const DISTRICTS = [
  'AMPARA',
  'ANURADHAPURA',
  'BADULLA',
  'BATTICALOA',
  'COLOMBO',
  'GALLE',
  'GAMPAHA',
  'HAMBANTOTA',
  'JAFFNA',
  'KALUTARA',
  'KANDY',
  'KEGALLE',
  'KILINOCHCHI',
  'KURUNEGALA',
  'MANNAR',
  'MATALE',
  'MATARA',
  'MONARAGALA',
  'MULLAITIVU',
  'NUWARA_ELIYA',
  'POLONNARUWA',
  'PUTTALAM',
  'RATNAPURA',
  'TRINCOMALEE',
  'VAVUNIYA',
] as const;

export type District = (typeof DISTRICTS)[number];

export interface DistrictInfo extends GeoLocation {
  name: string;
}

/** Display name, and the district capital's position used as the district centre on maps. */
export const DISTRICT_INFO: Record<District, DistrictInfo> = {
  AMPARA: { name: 'Ampara', latitude: 7.2975, longitude: 81.682 },
  ANURADHAPURA: { name: 'Anuradhapura', latitude: 8.3114, longitude: 80.4037 },
  BADULLA: { name: 'Badulla', latitude: 6.9934, longitude: 81.055 },
  BATTICALOA: { name: 'Batticaloa', latitude: 7.731, longitude: 81.6747 },
  COLOMBO: { name: 'Colombo', latitude: 6.9271, longitude: 79.8612 },
  GALLE: { name: 'Galle', latitude: 6.0535, longitude: 80.221 },
  GAMPAHA: { name: 'Gampaha', latitude: 7.084, longitude: 80.0098 },
  HAMBANTOTA: { name: 'Hambantota', latitude: 6.1241, longitude: 81.1185 },
  JAFFNA: { name: 'Jaffna', latitude: 9.6615, longitude: 80.0255 },
  KALUTARA: { name: 'Kalutara', latitude: 6.5854, longitude: 79.9607 },
  KANDY: { name: 'Kandy', latitude: 7.2906, longitude: 80.6337 },
  KEGALLE: { name: 'Kegalle', latitude: 7.2513, longitude: 80.3464 },
  KILINOCHCHI: { name: 'Kilinochchi', latitude: 9.3803, longitude: 80.377 },
  KURUNEGALA: { name: 'Kurunegala', latitude: 7.4863, longitude: 80.3623 },
  MANNAR: { name: 'Mannar', latitude: 8.981, longitude: 79.9044 },
  MATALE: { name: 'Matale', latitude: 7.4675, longitude: 80.6234 },
  MATARA: { name: 'Matara', latitude: 5.9549, longitude: 80.555 },
  MONARAGALA: { name: 'Monaragala', latitude: 6.8728, longitude: 81.3507 },
  MULLAITIVU: { name: 'Mullaitivu', latitude: 9.2671, longitude: 80.8142 },
  NUWARA_ELIYA: { name: 'Nuwara Eliya', latitude: 6.9497, longitude: 80.7891 },
  POLONNARUWA: { name: 'Polonnaruwa', latitude: 7.9403, longitude: 81.0188 },
  PUTTALAM: { name: 'Puttalam', latitude: 8.0362, longitude: 79.8283 },
  RATNAPURA: { name: 'Ratnapura', latitude: 6.6828, longitude: 80.3992 },
  TRINCOMALEE: { name: 'Trincomalee', latitude: 8.5874, longitude: 81.2152 },
  VAVUNIYA: { name: 'Vavuniya', latitude: 8.7514, longitude: 80.4971 },
};

export function districtName(district: District): string {
  return DISTRICT_INFO[district].name;
}

/**
 * The district whose centre is closest. Flat-earth distance with the
 * longitude scaled by latitude: accurate enough across a country this small.
 */
export function nearestDistrict({
  latitude,
  longitude,
}: GeoLocation): District {
  const scale = Math.cos((latitude * Math.PI) / 180);
  let best: District = DISTRICTS[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const district of DISTRICTS) {
    const centre = DISTRICT_INFO[district];
    const dx = (centre.longitude - longitude) * scale;
    const dy = centre.latitude - latitude;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = district;
      bestDistance = distance;
    }
  }
  return best;
}

const SRI_LANKAN_MOBILE = /^(?:\+94|0094|0)?(7\d{8})$/;

/** "077 123 4567", "+94771234567", "0094-77-1234567" all become "+94771234567"; anything else is null. */
export function normalizeSriLankanMobile(input: string): string | null {
  const match = SRI_LANKAN_MOBILE.exec(input.replace(/[\s-]/g, ''));
  return match ? `+94${match[1]}` : null;
}
