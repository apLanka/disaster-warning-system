/** The database name in a MongoDB connection string, or null when there is none. */
export function databaseNameOf(url: string): string | null {
  try {
    const name = new URL(url).pathname.replace(/^\//, '');
    return name === '' ? null : decodeURIComponent(name);
  } catch {
    return null;
  }
}

/**
 * The seed deletes and rewrites its own demo data, so it only runs against a
 * database whose name says it is for development or testing.
 */
export function assertSafeDatabase(url: string | undefined): string {
  if (!url) throw new Error('DATABASE_URL is not set');
  const name = databaseNameOf(url);
  if (!name) {
    throw new Error(
      'The connection string has no database name; refusing to seed',
    );
  }
  if (!/dev|test/i.test(name)) {
    throw new Error(
      `Refusing to seed "${name}": the database name must contain "dev" or "test"`,
    );
  }
  return name;
}
