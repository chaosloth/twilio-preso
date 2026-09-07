import Twilio from 'twilio';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';

/**
 * Fastify `preHandler` for TwiML webhooks. Twilio calls these, so they cannot
 * carry a presenter token — but leaving them open means anyone who learns the
 * URL can make this account place calls. Twilio signs each request with the
 * account auth token; we recompute the signature over the exact URL Twilio used.
 *
 * `PUBLIC_BASE_URL` matters: the signature covers the full URL including scheme
 * and host, and behind Fly's proxy `request.protocol` reports http while Twilio
 * signed https. Getting that wrong rejects every legitimate webhook.
 */
export async function requireTwilioSignature(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const signature = request.headers['x-twilio-signature'];
  if (typeof signature !== 'string') {
    request.log.warn({ url: request.url }, 'TwiML webhook without a Twilio signature');
    return reply.status(403).send({ error: 'Missing Twilio signature' });
  }

  const base = config.publicBaseUrl.replace(/\/$/, '');
  const url = `${base}${request.url}`;

  const valid = Twilio.validateRequest(
    config.twilio.authToken,
    signature,
    url,
    (request.body as Record<string, string>) ?? {}
  );

  if (!valid) {
    request.log.warn({ url }, 'TwiML webhook failed signature validation');
    return reply.status(403).send({ error: 'Invalid Twilio signature' });
  }
}
