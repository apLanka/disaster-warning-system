import '@testing-library/jest-dom/vitest';

// Tests must give the same result on every machine, so they never see the values in
// a developer's .env.local. This runs before any test file imports src/config.ts.
vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000');
vi.stubEnv('VITE_OFFICER_KEY', 'test-officer-key');
vi.stubEnv('VITE_OFFICER_NAME', 'Duty Officer');
