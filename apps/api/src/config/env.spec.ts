import { validateEnv } from './env.js';

const valid = {
  DATABASE_URL: 'mongodb+srv://user:pass@cluster.example.net/dws_dev',
  OFFICER_API_KEY: 'a-sufficiently-long-key',
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: '123456',
  CLOUDINARY_API_SECRET: 'secret',
};

describe('validateEnv', () => {
  it('returns typed values and defaults the port', () => {
    const env = validateEnv(valid);

    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(env.DATABASE_URL_TEST).toBeUndefined();
  });

  it('coerces PORT from a string', () => {
    expect(validateEnv({ ...valid, PORT: '4100' }).PORT).toBe(4100);
  });

  it('keeps the optional test database url', () => {
    const url = 'mongodb://localhost:27017/dws_test';

    expect(
      validateEnv({ ...valid, DATABASE_URL_TEST: url }).DATABASE_URL_TEST,
    ).toBe(url);
  });

  it('reports every missing required variable in one error', () => {
    expect(() => validateEnv({})).toThrowError(
      /DATABASE_URL is required[\s\S]*OFFICER_API_KEY is required[\s\S]*CLOUDINARY_API_SECRET is required/,
    );
  });

  it('treats blank and non-string values as missing', () => {
    expect(() =>
      validateEnv({ ...valid, CLOUDINARY_API_KEY: '   ' }),
    ).toThrowError(/CLOUDINARY_API_KEY is required/);
    expect(() =>
      validateEnv({ ...valid, CLOUDINARY_API_KEY: 42 }),
    ).toThrowError(/CLOUDINARY_API_KEY is required/);
  });

  it('rejects values that still hold a <placeholder>', () => {
    expect(() =>
      validateEnv({ ...valid, CLOUDINARY_API_KEY: '<api-key>' }),
    ).toThrowError(/CLOUDINARY_API_KEY still contains a <placeholder>/);
  });

  it('rejects a database url that is not a mongodb url', () => {
    expect(() =>
      validateEnv({ ...valid, DATABASE_URL: 'postgres://localhost/db' }),
    ).toThrowError(/DATABASE_URL must start with mongodb/);
    expect(() =>
      validateEnv({ ...valid, DATABASE_URL_TEST: 'http://localhost' }),
    ).toThrowError(/DATABASE_URL_TEST must start with mongodb/);
  });

  it('rejects a short officer key', () => {
    expect(() =>
      validateEnv({ ...valid, OFFICER_API_KEY: 'short' }),
    ).toThrowError(/OFFICER_API_KEY must be at least 16 characters/);
  });

  it.each(['0', '70000', 'abc', '30.5'])('rejects PORT %s', (port) => {
    expect(() => validateEnv({ ...valid, PORT: port })).toThrowError(
      /PORT must be an integer between 1 and 65535/,
    );
  });
  describe('SIMULATE_CHANNEL_FAILURE', () => {
    it('defaults to no simulated failures', () => {
      expect(validateEnv(valid).SIMULATE_CHANNEL_FAILURE).toEqual([]);
    });

    it('reads a comma list in any case and spacing', () => {
      const env = validateEnv({
        ...valid,
        SIMULATE_CHANNEL_FAILURE: ' sms, Audible ',
      });
      expect(env.SIMULATE_CHANNEL_FAILURE).toEqual(['SMS', 'AUDIBLE']);
    });

    it('rejects an unknown channel', () => {
      expect(() =>
        validateEnv({ ...valid, SIMULATE_CHANNEL_FAILURE: 'SMS,FAX' }),
      ).toThrow('SIMULATE_CHANNEL_FAILURE has unknown channel FAX');
    });
  });
});
