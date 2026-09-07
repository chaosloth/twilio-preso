// Temporary: a second presenter dev server for the two-session smoke run.
// Two Vite servers in one package must not share node_modules/.vite — they
// clobber each other's dep-optimize cache and the page ends up with two copies
// of React (invalid hook call) and of Three.
import base from './vite.config';
import { mergeConfig } from 'vite';

export default mergeConfig(base, {
  cacheDir: 'node_modules/.vite-smoke-b',
  server: { port: 3004, strictPort: true },
});
