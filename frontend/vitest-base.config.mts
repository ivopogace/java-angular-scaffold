import { defineConfig } from 'vitest/config';

/**
 * Merged into the builder's own Vitest config (`runnerConfig: true` in `angular.json`).
 * The setup file is registered here, not in the builder's `setupFiles`, so Vitest resolves it
 * directly and runs it once per test file.
 */
export default defineConfig({
  test: {
    setupFiles: ['./src/test-setup.ts'],
  },
});
