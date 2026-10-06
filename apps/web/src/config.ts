export const DEFAULT_API_BASE_URL = 'http://localhost:3000';
export const DEFAULT_OFFICER_NAME = 'Duty Officer';

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  officerKey: import.meta.env.VITE_OFFICER_KEY ?? '',
  officerName: import.meta.env.VITE_OFFICER_NAME ?? DEFAULT_OFFICER_NAME,
};
