import type { FastifyInstance } from 'fastify';
import { lookupPhone, startVerification, checkVerification } from '../services/verify.js';
import type { VerifyChannel } from '../services/verify.js';
import { DEFAULT_VERIFY_CHANNEL, VERIFY_CHANNELS, verifyChannelFor } from '@twilio-preso/shared';
import { getSessionById } from '../services/sessions.js';

/** The session's choice, or the default. Registration is public and a phone may
 *  send no session at all, so an unknown id is not an error here. */
async function sessionVerifyChannel(sessionId?: string): Promise<VerifyChannel> {
  if (!sessionId) return DEFAULT_VERIFY_CHANNEL;
  const session = await getSessionById(sessionId);
  return session ? verifyChannelFor(session) : DEFAULT_VERIFY_CHANNEL;
}

interface StartBody { phone: string; channel?: VerifyChannel; sessionId?: string; }
interface CheckBody { phone: string; code: string; }

export async function verifyRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: StartBody }>('/api/verify/start', async (request, reply) => {
    const { phone } = request.body;
    if (!phone) return reply.status(400).send({ error: 'phone is required' });

    const lookup = await lookupPhone(phone);
    if (!lookup.valid) {
      return reply.status(400).send({ error: 'Invalid phone number. Please include country code (e.g. +61...)' });
    }

    /**
     * An explicit choice from the phone wins — the attendee pressed a button. With
     * none, the session's own setting decides, so a room whose WhatsApp sender is
     * not ready can be switched to SMS in the HUD without redeploying anything.
     * A phone on a cached bundle that sends neither still lands on the default.
     */
    const requested: VerifyChannel = VERIFY_CHANNELS.includes(request.body.channel as VerifyChannel)
      ? (request.body.channel as VerifyChannel)
      : await sessionVerifyChannel(request.body.sessionId);
    const channel = await startVerification(lookup.formatted, requested);
    return { formatted: lookup.formatted, channel };
  });

  app.post<{ Body: CheckBody }>('/api/verify/check', async (request, reply) => {
    const { phone, code } = request.body;
    if (!phone || !code) return reply.status(400).send({ error: 'phone and code are required' });

    const approved = await checkVerification(phone, code);
    if (!approved) {
      return reply.status(400).send({ error: 'Invalid or expired code. Try again.' });
    }

    return { verified: true };
  });
}
