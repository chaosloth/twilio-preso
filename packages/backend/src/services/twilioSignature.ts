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
 * `Twilio.validateRequest` computes on its own.
 *
 * Twilio sends the body hash **itself**, as a `bodySHA256` query parameter on the
 * request line, and signs the URL including it. So `url` is the URL that arrived,
 * appended to nothing: computing the hash and adding a second `?bodySHA256=`
 * hashes `…?bodySHA256=x?bodySHA256=x` and rejects every real callback.
 *
 * `Twilio.validateRequestWithBody` is that check — the signature over the whole
 * URL, plus the raw body hashed against the parameter in it — so it is used
 * rather than rebuilt. The raw bytes are what must reach here: re-stringifying
 * the parsed body changes key order and whitespace, and the hash with them.
 */
export function jsonSignatureValid(
  authToken: string,
  signature: string,
  url: string,
  rawBody: string
): boolean {
  if (!authToken || !signature) return false;
  try {
    return Twilio.validateRequestWithBody(authToken, signature, url, rawBody);
  } catch {
    // A URL with no `bodySHA256` at all: not a callback Twilio signed this way.
    return false;
  }
}

/**
 * Whether the Orchestrator webhook is accepting unsigned callbacks.
 *
 * Deliberately run-time state rather than a stored setting: a bypass left on is
 * an open LLM-and-SMS endpoint, so a restart or a deploy has to close it again.
 * `ORCHESTRATOR_SKIP_SIGNATURE` seeds it for local work behind a tunnel, where
 * the signed origin and the origin serving the request are easy to get apart.
 */
let signatureBypass = process.env.ORCHESTRATOR_SKIP_SIGNATURE === 'true';

export function isSignatureBypassed(): boolean {
  return signatureBypass;
}

export function setSignatureBypass(enabled: boolean): boolean {
  signatureBypass = enabled;
  return signatureBypass;
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
  if (signatureBypass) {
    // Warned every time, not once: an open webhook that has gone quiet in the log
    // is how a bypass turned on to debug a tunnel survives into an event.
    request.log.warn(
      { url: request.url },
      'Orchestrator signature validation is BYPASSED — this webhook is open'
    );
    return;
  }

  const signature = request.headers['x-twilio-signature'];
  const raw = (request as FastifyRequest & { rawBody?: string }).rawBody;
  if (typeof signature !== 'string' || typeof raw !== 'string') {
    request.log.warn({ url: request.url }, 'Orchestrator callback without a Twilio signature');
    return reply.status(403).send({ error: 'Missing Twilio signature' });
  }

  const base = config.publicBaseUrl.replace(/\/$/, '');
  const url = `${base}${request.url}`;

  if (!jsonSignatureValid(config.twilio.authToken, signature, url, raw)) {
    request.log.warn(
      { url, hasBodyHash: url.includes('bodySHA256=') },
      'Orchestrator callback failed signature validation'
    );
    return reply.status(403).send({ error: 'Invalid Twilio signature' });
  }
}
