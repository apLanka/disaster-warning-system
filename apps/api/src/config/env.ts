export interface Env {
  PORT: number;
  DATABASE_URL: string;
  DATABASE_URL_TEST?: string;
  OFFICER_API_KEY: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
}

const DEFAULT_PORT = 3000;
const MIN_OFFICER_KEY_LENGTH = 16;
const MONGODB_URL = /^mongodb(\+srv)?:\/\//;
const PLACEHOLDER = /<[^>]+>/;

const REQUIRED_STRINGS = [
  'DATABASE_URL',
  'OFFICER_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

function readString(
  config: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = config[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Validates the raw environment once at startup so a misconfigured deployment
 * fails immediately with every problem listed, not on the first request.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const errors: string[] = [];
  const values: Record<string, string> = {};

  for (const key of REQUIRED_STRINGS) {
    const value = readString(config, key);
    if (value === undefined) {
      errors.push(`${key} is required`);
    } else if (PLACEHOLDER.test(value)) {
      errors.push(`${key} still contains a <placeholder>`);
    } else {
      values[key] = value;
    }
  }

  for (const key of ['DATABASE_URL', 'DATABASE_URL_TEST'] as const) {
    const value =
      key === 'DATABASE_URL' ? values[key] : readString(config, key);
    if (value !== undefined && !MONGODB_URL.test(value)) {
      errors.push(`${key} must start with mongodb:// or mongodb+srv://`);
    }
  }

  if (
    values['OFFICER_API_KEY'] !== undefined &&
    values['OFFICER_API_KEY'].length < MIN_OFFICER_KEY_LENGTH
  ) {
    errors.push(
      `OFFICER_API_KEY must be at least ${MIN_OFFICER_KEY_LENGTH} characters`,
    );
  }

  const rawPort = readString(config, 'PORT');
  const port = rawPort === undefined ? DEFAULT_PORT : Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT must be an integer between 1 and 65535');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }

  return {
    PORT: port,
    DATABASE_URL: values['DATABASE_URL'] as string,
    DATABASE_URL_TEST: readString(config, 'DATABASE_URL_TEST'),
    OFFICER_API_KEY: values['OFFICER_API_KEY'] as string,
    CLOUDINARY_CLOUD_NAME: values['CLOUDINARY_CLOUD_NAME'] as string,
    CLOUDINARY_API_KEY: values['CLOUDINARY_API_KEY'] as string,
    CLOUDINARY_API_SECRET: values['CLOUDINARY_API_SECRET'] as string,
  };
}
