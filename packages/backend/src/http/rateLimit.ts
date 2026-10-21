import type { FastifyInstance, FastifyRequest, FastifyServerOptions } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * The backend's rate limiting, in one place so the load test registers exactly
 * what production registers (`src/__tests__/load/audienceJoin.load.test.ts`).
 *
 * **An IP address is not a person at an event.** Behind Fly every request comes
 * from the edge proxy, which `clientIp` sees through — but a hotel or conference
 * Wi-Fi network then puts the whole room behind *one* public address anyway, so
 * any per-IP limit on the audience's join path is a limit on the room. The load
 * test's `venue-wifi` case is that room: 300 phones, one address.
 *
 * So each limit keys on what it actually protects:
 *
 * - **Join-code guessing** counts *failed* lookups per address
 *   (`joinCodeGuessLimit`). A room resolving the right code produces none; an
 *   attacker enumerating codes produces nothing else.
 * - **OTP sends and checks** are limited per *phone number* by Twilio Verify
 *   itself — five sends and five checks per verification, 60203/60202 — which no
 *   network shape can spread across a room.
 * - **Everything else** gets a per-address flood ceiling sized for a full room
 *   on one Wi-Fi. A join is five requests (code, OTP start, OTP check,
 *   register, Sync token) and each poll answer one more, so a thousand
 *   attendees joining and answering in the same minute is ~6,000 from one
 *   address. 20,000 holds three times that; at ~330 a second it still stops a
 *   client looping on an endpoint. The load test at `LOAD_ROOM_SIZE=1000`
 *   crossed the previous 5,000.
 */
export const FLOOD_CEILING_PER_MINUTE = 20_000;

export async function registerRateLimiting(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: FLOOD_CEILING_PER_MINUTE,
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
 * Keying the limiter on the socket put a whole room in one bucket even on
 * cellular.
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

/**
 * Join-code guessing, limited on the only signal that separates it from a room:
 * a guess is a code that does not exist.
 *
 * Counted per address, and only on a miss. A room on one Wi-Fi resolving the
 * code on screen never adds to it, however large; someone enumerating the
 * Crockford-base32 space misses on almost every try and is stopped after
 * `max` in a window. A handful of attendees mistyping the code on the same
 * Wi-Fi is the edge — `max` is set so a room's worth of typos still fits.
 *
 * In memory, per machine, like the plugin's own store: two backend machines
 * double the effective budget, which is acceptable for this — the code space is
 * 32^6, and 2 × 30 guesses a minute is not a way through it.
 */
export function joinCodeGuessLimit(options: { max: number; windowMs: number }) {
  const misses = new Map<string, { count: number; resetAt: number }>();

  /** Whether this address has used up its misses. Call before the lookup. */
  function blocked(request: Pick<FastifyRequest, 'ip' | 'headers'>): number | null {
    const entry = misses.get(clientIp(request));
    if (!entry || entry.resetAt <= Date.now()) return null;
    return entry.count >= options.max ? Math.ceil((entry.resetAt - Date.now()) / 1000) : null;
  }

  /** Record a lookup that found nothing. */
  function miss(request: Pick<FastifyRequest, 'ip' | 'headers'>): void {
    const key = clientIp(request);
    const now = Date.now();
    const entry = misses.get(key);
    if (!entry || entry.resetAt <= now) {
      misses.set(key, { count: 1, resetAt: now + options.windowMs });
      // Bounded: an expired entry is dropped on the next miss from anyone, so a
      // scan from many addresses cannot grow this without limit.
      if (misses.size > 10_000) {
        for (const [k, v] of misses) if (v.resetAt <= now) misses.delete(k);
      }
    } else {
      entry.count++;
    }
  }

  return { blocked, miss };
}

/** The Fastify options production boots with — the load test boots the same. */
export const serverOptions: FastifyServerOptions = { logger: true };
