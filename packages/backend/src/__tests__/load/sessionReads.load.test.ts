import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Load test: what a room's join costs the `sessions` Sync map.
 *
 * The production load test after the rate-limit fix still lost a third of 300
 * lookups — to Sync, not to this app: `Rate limit exceeded for read-map-sessions`.
 * Every join-code lookup fetched the map item, and every session-scoped route
 * listed the whole map, so a room scanning the QR at once was hundreds of reads
 * of one object inside a second. And a throttled read came back as `null`, so the
 * attendee holding the right code was told it was wrong.
 *
 * This drives the real `services/sessions.ts` against a Sync stub that counts
 * reads and throttles the way Sync does — past `SYNC_READS_PER_BURST` in flight
 * it answers 429 — so the property under test is the read count, which is what
 * Sync actually limits.
 */

const ROOM = Number(process.env.LOAD_ROOM_SIZE || 300);
/** Concurrent reads of one map Sync will serve before throttling. A stand-in:
 *  what matters is that a room is far above it and one shared read is below. */
const SYNC_READS_PER_BURST = 25;

const SESSION = { id: 'sess-load', joinCode: 'F97RSF', status: 'live', createdAt: 1 };
const reads = { fetch: 0, list: 0, inFlight: 0, forceThrottle: false };

function throttled<T>(value: () => T): Promise<T> {
  reads.inFlight++;
  const over = reads.forceThrottle || reads.inFlight > SYNC_READS_PER_BURST;
  return new Promise<T>((resolve, reject) =>
    setTimeout(() => {
      reads.inFlight--;
      if (over) {
        reject(Object.assign(new Error('Rate limit exceeded for read-map-sessions'), { status: 429, code: 20429 }));
        return;
      }
      try {
        resolve(value());
      } catch (err) {
        reject(err);
      }
    }, 20)
  );
}

vi.mock('twilio', () => {
  const syncMapItems = Object.assign(
    (key: string) => ({
      fetch: () => {
        reads.fetch++;
        return throttled(() => {
          if (key !== SESSION.joinCode) throw Object.assign(new Error('not found'), { status: 404, code: 20404 });
          return { data: SESSION };
        });
      },
    }),
    {
      list: () => {
        reads.list++;
        return throttled(() => [{ data: SESSION }]);
      },
    }
  );
  return { default: () => ({ sync: { v1: { services: () => ({ syncMaps: () => ({ syncMapItems }) }) } } }) };
});
vi.mock('../../services/sync.js', () => ({ initSessionSync: vi.fn(), teardownSessionSync: vi.fn() }));

const { getSessionByCode, getSessionById } = await import('../../services/sessions.js');

beforeEach(() => {
  reads.fetch = 0;
  reads.list = 0;
});

describe(`a room of ${ROOM} resolving its session at once`, () => {
  it('shares one Sync read for the join code instead of one per phone', async () => {
    const results = await Promise.allSettled(Array.from({ length: ROOM }, () => getSessionByCode('F97RSF')));
    const found = results.filter((r) => r.status === 'fulfilled' && r.value?.id === SESSION.id).length;
    console.log(`join-code: ${found}/${ROOM} resolved, ${reads.fetch} Sync reads`);
    expect(found).toBe(ROOM);
    expect(reads.fetch).toBe(1);
  });

  it('shares one listing for every session-scoped route in the burst', async () => {
    const results = await Promise.allSettled(Array.from({ length: ROOM }, () => getSessionById(SESSION.id)));
    const found = results.filter((r) => r.status === 'fulfilled' && r.value?.id === SESSION.id).length;
    console.log(`by-id: ${found}/${ROOM} resolved, ${reads.list} Sync listings`);
    expect(found).toBe(ROOM);
    expect(reads.list).toBe(1);
  });

  /** A throttled read is not a wrong code. Telling a room it is, is the bug. */
  it('reports a Sync failure as a failure, never as an unknown code', async () => {
    await expect(getSessionByCode('ZZZZZZ')).resolves.toBeNull();
    reads.forceThrottle = true;
    await expect(getSessionByCode('YYYYYY')).rejects.toThrow(/Rate limit/);
    reads.forceThrottle = false;
    // And a failure is not cached: the next read of the same code retries.
    await expect(getSessionByCode('YYYYYY')).resolves.toBeNull();
  });
});
