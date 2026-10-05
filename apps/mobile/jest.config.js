const expoPreset = require('jest-expo/jest-preset');

// jest-expo only whitelists pnpm's ".pnpm" store directory when deciding which
// node_modules to transform. Bun's isolated linker uses ".bun", so whitelist it too.
const transformIgnorePatterns = expoPreset.transformIgnorePatterns.map((pattern) =>
  pattern.replace('(?!(.pnpm|', '(?!(.pnpm|.bun|'),
);

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/*.test.tsx', '<rootDir>/src/**/*.test.ts'],
};
