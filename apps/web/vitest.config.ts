import { defineConfig } from 'vitest/config';

// Tests cover plain TypeScript (timers, reducer, labels), so no React plugin.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
