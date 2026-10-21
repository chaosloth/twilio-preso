import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

/**
 * Load test: a room joins at once.
 *
 * What happened at the last event: the audience app loaded (it is static, on
 * Vercel) but phones were told "Too many tries — wait a moment and try again"
 * when they started. That message is the 429 branch of `resolveJoinCode`.
 *
 * The cause this test reproduces is **where the requests appear to come from**.
 * Fly's edge proxies every request, so the socket Fastify sees is Fly's
 * (`172.16.x.x` in the production logs), with the attendee's real address only
 * in the `Fly-Client-IP` / `X-Forwarded-For` headers. `@fastify/rate-limit` keys
 * on `request.ip`, which without `trustProxy` is the proxy — so the whole room
 * shares one bucket.
 *
 * So the test drives the real routes and the real rate-limit registration with
 * Twilio stubbed out, and every simulated phone arrives exactly as it does on
 * Fly: the same proxy socket address, its own client IP in the headers. Each
 * phone runs the real join sequence — resolve the code, start and check the OTP,
 * register, fetch a Sync token — and the test counts who got through.
 *
 * `ROOM` and the per-phone sequence are what an event looks like; `PROXY` and
 * the header shape are what Fly sends. Change those, not the assertions, to
 * model a different room.
 */

const ROOM = Number(process.env.LOAD_ROOM_SIZE || 300);
const PROXY = '172.16.33.154';
const ARRIVAL_GAP_MS = 2;
const JOIN_CODE = 'F97RSF';
const SESSION = {
  id: 'sess-load',
  joinCode: JOIN_CODE,
  title: 'Load test',
  status: 'live',
  phoneNumber: '+61468157727',
  ownerPhone: '+61400000001',
  createdAt: 0,
  deck: { id: 'd', name: 'd', stages: [] },
};

// --- Twilio and the control plane, stubbed: this measures the HTTP layer only.
vi.mock('../../services/sessions.js', () => ({
  getSessionByCode: async () => SESSION,
  getSessionById: async () => SESSION,
  sessionIdForPhoneNumber: async () => SESSION.id,
  expectedVoiceUrl: () => '',
}));
vi.mock('../../services/verify.js', () => ({
  lookupPhone: async (phone: string) => ({ valid: true, formatted: phone }),
  startVerification: async () => 'sms',
  checkVerification: async () => true,
}));
vi.mock('../../services/memory.js', () => ({ upsertProfile: async () => null }));
vi.mock('../../services/messaging.js', () => ({ sendWelcomeSms: async () => {} }));
vi.mock('../../services/sync.js', () => {
  const participants = new Set<string>();
  return {
    addParticipant: async (_s: string, p: { id: string; phone: string }) => participants.add(p.id),
    updateParticipant: async () => {},
    publishEvent: async () => {},
    isSessionLive: async () => false,
    getParticipant: async (_s: string, id: string) => (participants.has(id) ? { id } : null),
    generateSyncToken: () => 'token',
    getPresentationState: async () => ({}),
  };
});

const { registerRateLimiting, serverOptions } = await import('../../http/rateLimit.js');
const { publicSessionRoutes } = await import('../../routes/sessions.js');
const { verifyRoutes } = await import('../../routes/verify.js');
const { registerRoutes } = await import('../../routes/register.js');
const { tokenRoutes } = await import('../../routes/token.js');

let app: FastifyInstance;

/** A fresh server per test: the limiter's buckets are in memory, and one test's
 *  traffic must not spend another's budget. */
beforeEach(async () => {
  app = Fastify({ ...serverOptions, logger: false });
  await registerRateLimiting(app);
  await app.register(publicSessionRoutes);
  await app.register(verifyRoutes);
  await app.register(registerRoutes);
  await app.register(tokenRoutes);
  await app.ready();
});

afterEach(() => app.close());

/** One attendee's phone, as Fly delivers it. */
function phone(i: number) {
  const clientIp = `203.0.${Math.floor(i / 250)}.${(i % 250) + 1}`;
  const number = `+614${String(10000000 + i).padStart(8, '0')}`;
  const headers = { 'fly-client-ip': clientIp, 'x-forwarded-for': clientIp };
  const call = (method: 'GET' | 'POST', url: string, payload?: object) =>
    app.inject({ method, url, payload, headers, remoteAddress: PROXY });
  return { clientIp, number, call };
}

type Step = 'resolve' | 'verify-start' | 'verify-check' | 'register' | 'token';

/** The real join sequence. Returns the step it failed on, or null. */
async function join(i: number): Promise<{ failedAt: Step | null; status?: number }> {
  const p = phone(i);
  const steps: Array<[Step, () => ReturnType<typeof p.call>]> = [
    ['resolve', () => p.call('GET', `/api/session/${JOIN_CODE}`)],
    ['verify-start', () => p.call('POST', '/api/verify/start', { phone: p.number, sessionId: SESSION.id })],
    ['verify-check', () => p.call('POST', '/api/verify/check', { phone: p.number, code: '123456' })],
  ];
  for (const [step, run] of steps) {
    const res = await run();
    if (res.statusCode >= 400) return { failedAt: step, status: res.statusCode };
  }
  const reg = await p.call('POST', '/api/register', {
    sessionId: SESSION.id,
    name: `Attendee ${i}`,
    phone: p.number,
  });
  if (reg.statusCode >= 400) return { failedAt: 'register', status: reg.statusCode };
  const { participantId } = reg.json();
  const token = await p.call('GET', `/api/token?identity=${participantId}&sessionId=${SESSION.id}`);
  if (token.statusCode >= 400) return { failedAt: 'token', status: token.statusCode };
  return { failedAt: null };
}

describe(`a room of ${ROOM} joining at once, through Fly's proxy`, () => {
  it('lets every attendee through the join sequence', async () => {
    // Phones arrive a couple of milliseconds apart, as a room scanning a QR does
    // over a few seconds — all well inside one rate-limit window. Truly
    // simultaneous requests would mislead: the limiter hands every in-flight
    // request the same counter object, so they all read the final count and a
    // burst of 11 rejects all 11, where a room in practice admits the first 10.
    const results = await Promise.all(
      Array.from({ length: ROOM }, (_, i) =>
        new Promise((r) => setTimeout(r, i * ARRIVAL_GAP_MS)).then(() => join(i))
      )
    );

    const failures: Record<string, number> = {};
    for (const r of results) {
      if (r.failedAt) {
        const key = `${r.failedAt} → ${r.status}`;
        failures[key] = (failures[key] ?? 0) + 1;
      }
    }
    const joined = results.filter((r) => !r.failedAt).length;
    console.log(`joined ${joined}/${ROOM}`, failures);

    expect(failures).toEqual({});
    expect(joined).toBe(ROOM);
  });

  /**
   * The limits still have to bite on one real client — a guessed join code is
   * the attack path they exist for. Without this, "fix" could mean "removed".
   */
  it('still rate-limits a single phone guessing join codes', async () => {
    const p = phone(9999);
    const statuses: number[] = [];
    for (let n = 0; n < 15; n++) statuses.push((await p.call('GET', `/api/session/GUESS${n}`)).statusCode);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});
