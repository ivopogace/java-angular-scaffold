import { defineConfig } from 'vitest/config';

// The setup file is registered here, not in the builder's `setupFiles`, so Vitest runs it once per file.
export default defineConfig({
  test: {
    setupFiles: ['./src/test-setup.ts'],
  },
});
