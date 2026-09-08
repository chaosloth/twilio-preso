import { defineConfig } from 'vitest/config';

/**
 * The backend's config module validates its environment at import time, so a
 * test that touches any service needs one. These are deliberately fake: `dotenv`
 * does not override variables that already exist, so a real `.env` sitting next
 * to the repo cannot leak live credentials into a test run.
 */
export default defineConfig({
  test: {
    env: {
      TWILIO_ACCOUNT_SID: 'ACtest',
      TWILIO_AUTH_TOKEN: 'test-token',
      TWILIO_API_KEY_SID: 'SKtest',
      TWILIO_API_KEY_SECRET: 'test-secret',
      TWILIO_SYNC_SERVICE_SID: 'IStest',
      TWILIO_VERIFY_SERVICE_SID: 'VAtest',
      TWILIO_MESSAGING_SERVICE_SID: 'MGtest',
      TWILIO_PHONE_NUMBER: '+61400000000',
      TWILIO_MEMORY_STORE_ID: 'MStest',
      PRESENTER_JWT_SECRET: 'test-jwt-secret',
    },
  },
});
