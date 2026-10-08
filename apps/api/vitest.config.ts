import { configDefaults, defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

const DATABASE_SPECS = ['**/*.integration.spec.ts', 'test/**/*.spec.ts'];
const MINIMUM = { lines: 80, functions: 80, branches: 80, statements: 80 };

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    // Suites that use the shared dws_test database wipe its collections, so
    // they must run one file at a time. Pure unit tests stay parallel.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['**/*.spec.ts'],
          exclude: [...configDefaults.exclude, ...DATABASE_SPECS],
        },
      },
      {
        extends: true,
        test: {
          name: 'database',
          include: DATABASE_SPECS,
          fileParallelism: false,
          // Every call crosses the network to Atlas, so the 5s default is too tight.
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.spec.ts',
        'src/main.ts',
        'src/testing/**',
        'src/**/testing/**',
        'src/**/testing.ts',
        'src/analysis/seed/seed-analysis.ts',
      ],
      // The use case code is held to the assignment's 80% expectation; a drop
      // below it fails `bun run test:cov`.
      thresholds: {
        ...MINIMUM,
        'src/hazard-reports/**': MINIMUM,
        'src/notifications/**': MINIMUM,
        'src/analysis/**': MINIMUM,
        'src/hazard-warnings/**': MINIMUM,
        'src/citizens/**': MINIMUM,
      },
    },
  },
});
