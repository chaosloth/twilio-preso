import type { FastifyInstance, FastifyRequest, FastifyServerOptions } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * The backend's rate limiting, in one place so the load test registers exactly
 * what production registers (`src/__tests__/load/audienceJoin.load.test.ts`).
 *
 * Global ceiling; the public auth and join-code lookups tighten it per-route.
 * A guessed join code is the whole attack path on the audience side.
 */
export async function registerRateLimiting(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: clientIp,
    /**
     * `{error}`, not the plugin's `{message}`: every audience screen reads
     * `err.error`, so the default shape fell through to "Invalid phone number"
     * or "Registration failed" — a throttle reported as the attendee's mistake.
     */
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: `Too many requests — try again in ${context.after}`,
    }),
  });
}

/**
 * Who a request is actually from.
 *
 * On Fly every request reaches the app from Fly's edge proxy over the private
 * network, so the socket address is the proxy's — `172.16.x.x` in the
 * production logs — and the attendee's real address is in `Fly-Client-IP`.
 * Keying the limiter on the socket put a whole room in one bucket: the
 * join-code lookup allows ten a minute, so the eleventh phone to scan the QR at
 * the last event was told "Too many tries". The load test reproduces exactly
 * that: 10 of 300 joined.
 *
 * The header is believed **only** from a private address. Fly's proxy always
 * sets it, overwriting anything the client sent, but a request reaching the app
 * some other way could set it itself — and a header anyone can write is a rate
 * limit anyone can step around.
 */
export function clientIp(request: Pick<FastifyRequest, 'ip' | 'headers'>): string {
  const flyClientIp = request.headers['fly-client-ip'];
  if (typeof flyClientIp === 'string' && flyClientIp && isPrivate(request.ip)) {
    return flyClientIp.trim();
  }
  return request.ip;
}

/** RFC 1918, Fly's 6PN (`fdaa::/16`) and loopback — the addresses the edge
 *  proxy can reach the app from. */
function isPrivate(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/, '');
  return (
    /^10\./.test(v4) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v4) ||
    /^192\.168\./.test(v4) ||
    /^127\./.test(v4) ||
    /^fdaa:/i.test(ip) ||
    ip === '::1'
  );
}

/** The Fastify options production boots with — the load test boots the same. */
export const serverOptions: FastifyServerOptions = { logger: true };
