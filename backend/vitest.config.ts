import { defineConfig } from 'vitest/config';

// Backend unit tests.
//
// These are hermetic on purpose: no database, no network, no Express server.
// Anything that touches Prisma is mocked (see tests/auth-middleware.test.ts).
//
// tests/ sits outside tsconfig.json's include list (which covers src only, with
// rootDir ./src), so `tsc --noEmit` type-checks the application and never trips
// over test helpers.
//
// Run:  npm run test:ci   single pass, used by CI
//       npm test          watch mode
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    // Vitest loads .env like any Vite tool; keep it off so the tests cannot
    // silently pick up a real DATABASE_URL and talk to the live store.
    dotenv: [],
  },
});
