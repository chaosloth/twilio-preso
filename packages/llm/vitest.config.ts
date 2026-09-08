import { defineConfig } from 'vitest/config';

/**
 * Source only. `dist` holds compiled copies of these same tests, and collecting
 * them runs every case twice — the second time against whatever was last built,
 * so a stale `dist` can pass a test the source would fail.
 */
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
