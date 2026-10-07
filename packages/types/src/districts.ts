export const DISTRICTS = [
  { code: 'AMP', name: 'Ampara' },
  { code: 'ANU', name: 'Anuradhapura' },
  { code: 'BDL', name: 'Badulla' },
  { code: 'BTC', name: 'Batticaloa' },
  { code: 'CMB', name: 'Colombo' },
  { code: 'GAL', name: 'Galle' },
  { code: 'GMP', name: 'Gampaha' },
  { code: 'HBA', name: 'Hambantota' },
  { code: 'JAF', name: 'Jaffna' },
  { code: 'KAL', name: 'Kalutara' },
  { code: 'KAN', name: 'Kandy' },
  { code: 'KEG', name: 'Kegalle' },
  { code: 'KIL', name: 'Kilinochchi' },
  { code: 'KUR', name: 'Kurunegala' },
  { code: 'MAN', name: 'Mannar' },
  { code: 'MTL', name: 'Matale' },
  { code: 'MTR', name: 'Matara' },
  { code: 'MON', name: 'Monaragala' },
  { code: 'MUL', name: 'Mullaitivu' },
  { code: 'NUW', name: 'Nuwara Eliya' },
  { code: 'POL', name: 'Polonnaruwa' },
  { code: 'PUT', name: 'Puttalam' },
  { code: 'RAT', name: 'Ratnapura' },
  { code: 'TRI', name: 'Trincomalee' },
  { code: 'VAV', name: 'Vavuniya' },
] as const;

export type DistrictCode = (typeof DISTRICTS)[number]['code'];

export const DISTRICT_CODES: readonly DistrictCode[] = DISTRICTS.map(
  (d) => d.code,
);

export function isDistrictCode(value: string): value is DistrictCode {
  return (DISTRICT_CODES as readonly string[]).includes(value);
}

/** Display name for a district code; falls back to the code itself. */
export function districtName(code: string): string {
  return DISTRICTS.find((d) => d.code === code)?.name ?? code;
}
