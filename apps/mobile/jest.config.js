const expoPreset = require('jest-expo/jest-preset');

// jest-expo only whitelists pnpm's ".pnpm" store directory when deciding which
// node_modules to transform. Bun's isolated linker uses ".bun", so whitelist it too.
const transformIgnorePatterns = expoPreset.transformIgnorePatterns.map(
  (pattern) => pattern.replace('(?!(.pnpm|', '(?!(.pnpm|.bun|'),
);

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Call counts never leak from one test into the next.
  clearMocks: true,
  transformIgnorePatterns,
  // Jest picks lucide's .mjs build through the "react-native" export condition and
  // cannot load it; its CommonJS build works.
  moduleNameMapper: {
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/test/**',
    '!src/navigation/types.ts',
  ],
  // The assignment expects 80% of the functionality to be tested.
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
  testMatch: ['<rootDir>/src/**/*.test.tsx', '<rootDir>/src/**/*.test.ts'],
};
