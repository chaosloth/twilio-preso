import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
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

/**
 * Validates a Twilio signature over a **JSON** body — Conversation Orchestrator's
 * status callbacks, which are not form-encoded and so are not what
 * `Twilio.validateRequest` computes.
 *
 * The scheme, confirmed against real captured callbacks: HMAC-SHA1 over the URL
 * with `?bodySHA256=<sha256 hex of the raw body>` appended. Twilio does **not**
 * send that query parameter, so it cannot be read off the request — which also
 * means the raw bytes have to be kept: re-stringifying the parsed body changes
 * key order and whitespace and the hash with it.
 */
export function jsonSignatureValid(
  authToken: string,
  signature: string,
  url: string,
  rawBody: string
): boolean {
  if (!authToken || !signature) return false;
  const hash = createHash('sha256').update(rawBody, 'utf8').digest('hex');
  const expected = createHmac('sha1', authToken)
    .update(`${url}?bodySHA256=${hash}`, 'utf8')
    .digest('base64');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Fastify `preHandler` for the Orchestrator webhook. Same reasoning as the TwiML
 * one above — Twilio cannot carry a presenter token, and this route runs an LLM
 * turn and sends a real message, so it must not be open to anyone who learns the
 * URL. It needs `request.rawBody`, which the route's own content-type parser
 * keeps.
 */
export async function requireOrchestratorSignature(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const signature = request.headers['x-twilio-signature'];
  const raw = (request as FastifyRequest & { rawBody?: string }).rawBody;
  if (typeof signature !== 'string' || typeof raw !== 'string') {
    request.log.warn({ url: request.url }, 'Orchestrator callback without a Twilio signature');
    return reply.status(403).send({ error: 'Missing Twilio signature' });
  }

  const base = config.publicBaseUrl.replace(/\/$/, '');
  const url = `${base}${request.url}`;

  if (!jsonSignatureValid(config.twilio.authToken, signature, url, raw)) {
    request.log.warn({ url }, 'Orchestrator callback failed signature validation');
    return reply.status(403).send({ error: 'Invalid Twilio signature' });
  }
}
