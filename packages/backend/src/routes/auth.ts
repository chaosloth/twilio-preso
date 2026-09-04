import type { FastifyInstance } from 'fastify';
import { checkVerification, lookupPhone, startVerification } from '../services/verify.js';
import { isAllowlisted, getPresenter } from '../services/sessions.js';
import { requirePresenter, signPresenterToken } from '../services/auth.js';

interface StartBody {
  phone: string;
}

interface VerifyBody {
  phone: string;
  code: string;
}

/**
 * Twilio Verify errors that mean "stop trying for a while" rather than "wrong
 * code". The presenter needs these distinguished: one says try again, the other
 * says wait, and on stage guessing between them costs the whole session.
 */
const VERIFY_RATE_LIMIT_CODES = new Set([
  20429, // Too many requests
  60202, // Max check attempts reached
  60203, // Max send attempts reached
]);

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: StartBody }>(
    '/api/auth/start',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { phone } = request.body ?? {};
      if (!phone) return reply.status(400).send({ error: 'phone is required' });

      const lookup = await lookupPhone(phone);
      if (!lookup.valid) {
        return reply
          .status(400)
          .send({ error: 'Invalid phone number. Include the country code (e.g. +61...)' });
      }

      // Deliberately identical response whether or not the number is
      // allowlisted. Anything else turns this into an oracle for which of your
      // colleagues can present. An unlisted caller simply never gets a code.
      if (!(await isAllowlisted(lookup.formatted))) {
        request.log.warn({ phone: lookup.formatted }, 'auth/start for non-allowlisted phone');
        return { sent: true };
      }

      try {
        await startVerification(lookup.formatted);
      } catch (err: any) {
        if (VERIFY_RATE_LIMIT_CODES.has(err?.code)) {
          return reply
            .status(429)
            .send({ error: 'Too many attempts. Wait 10 minutes and try again.' });
        }
        // Never swallow this: a Verify outage means nobody gets on stage, and
        // the presenter must see why rather than staring at a silent form.
        request.log.error({ err }, 'auth/start failed');
        return reply
          .status(502)
          .send({ error: 'Could not send the code. Twilio Verify is not responding.' });
      }

      return { sent: true };
    }
  );

  app.post<{ Body: VerifyBody }>(
    '/api/auth/verify',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { phone, code } = request.body ?? {};
      if (!phone || !code) {
        return reply.status(400).send({ error: 'phone and code are required' });
      }

      const lookup = await lookupPhone(phone);
      const presenter = await getPresenter(lookup.formatted);

      let approved = false;
      try {
        approved = await checkVerification(lookup.formatted, code);
      } catch (err: any) {
        if (VERIFY_RATE_LIMIT_CODES.has(err?.code)) {
          return reply
            .status(429)
            .send({ error: 'Too many attempts. Wait 10 minutes and try again.' });
        }
        // 404 means no pending verification — an expired or already-used code.
        if (err?.status === 404) {
          return reply.status(400).send({ error: 'That code has expired. Request a new one.' });
        }
        request.log.error({ err }, 'auth/verify failed');
        return reply
          .status(502)
          .send({ error: 'Could not check the code. Twilio Verify is not responding.' });
      }

      // Check the allowlist *after* Verify, so a non-allowlisted caller who
      // somehow has a valid code still learns nothing about the allowlist: both
      // paths return the same "incorrect code".
      if (!approved || !presenter) {
        return reply.status(401).send({ error: 'Incorrect code. Try again.' });
      }

      const identity = { phone: presenter.phone, name: presenter.name };
      return { token: signPresenterToken(identity), ...identity };
    }
  );

  /** Token validation probe — the presenter app calls this at boot to decide
   *  whether to show the login gate. */
  app.get('/api/auth/me', { preHandler: requirePresenter }, async (request) => request.presenter);
}
