import { assertSafeDatabase, databaseNameOf } from './seed-guard.js';

const url = (db: string) =>
  `mongodb+srv://user:pass@cluster0.example.mongodb.net/${db}?retryWrites=true&w=majority`;

describe('databaseNameOf', () => {
  it('reads the name from the path', () => {
    expect(databaseNameOf(url('dws_dev'))).toBe('dws_dev');
    expect(databaseNameOf('mongodb://localhost:27017/dws_test')).toBe(
      'dws_test',
    );
  });

  it('is null when there is no name or the text is not a URL', () => {
    expect(databaseNameOf('mongodb://localhost:27017')).toBeNull();
    expect(databaseNameOf('mongodb://localhost:27017/')).toBeNull();
    expect(databaseNameOf('not a url')).toBeNull();
  });
});

describe('assertSafeDatabase', () => {
  it('allows development and test databases and returns the name', () => {
    expect(assertSafeDatabase(url('dws_dev'))).toBe('dws_dev');
    expect(assertSafeDatabase(url('dws_test'))).toBe('dws_test');
    expect(assertSafeDatabase(url('DWS_DEV'))).toBe('DWS_DEV');
  });

  it('refuses any other database', () => {
    expect(() => assertSafeDatabase(url('dws_prod'))).toThrow(
      /Refusing to seed "dws_prod"/,
    );
    expect(() => assertSafeDatabase(url('dws'))).toThrow(/must contain/);
  });

  it('refuses a missing URL or a URL without a database name', () => {
    expect(() => assertSafeDatabase(undefined)).toThrow(
      'DATABASE_URL is not set',
    );
    expect(() => assertSafeDatabase('mongodb://localhost:27017')).toThrow(
      /no database name/,
    );
  });
});
