import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load the repo-root .env synchronously so it is fully populated before
// config.ts evaluates. (A previous async dynamic import raced with tsx's
// module evaluation and left process.env empty at requireEnv time.)
if (process.env.NODE_ENV !== 'production') {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: resolve(__dirname, '../../../.env') });
}
