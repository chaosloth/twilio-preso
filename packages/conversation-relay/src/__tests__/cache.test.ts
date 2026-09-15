import { describe, expect, it, vi } from 'vitest';
import { TtlCache, memoizeByRef } from '../cache.js';

/** A deferred promise, so a test can hold a read open and observe overlap. */
function gate<T>() {
  let release!: (value: T) => void;
  let fail!: (err: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    release = resolve;
    fail = reject;
  });
  return { promise, release, fail };
}

describe('TtlCache', () => {
  /**
   * The property that actually collapses a finale: three hundred setups arriving
   * together must share one request, not race three hundred of their own. A TTL
   * alone would not help them — none of them has finished yet.
   */
  it('shares one in-flight read with every caller that arrives during it', async () => {
    const cache = new TtlCache<string>(60_000);
    const held = gate<string>();
    const read = vi.fn(() => held.promise);

    const callers = Promise.all(Array.from({ length: 300 }, () => cache.get('room', read)));
    held.release('the room');

    expect(await callers).toEqual(Array(300).fill('the room'));
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('hands every caller the same object, so a tally can be memoized on it', async () => {
    const cache = new TtlCache<string[]>(60_000);
    const list = ['a', 'b'];
    const [first, second] = await Promise.all([
      cache.get('room', async () => list),
      cache.get('room', async () => list),
    ]);
    expect(first).toBe(second);
  });

  it('re-reads once the value is older than the TTL', async () => {
    vi.useFakeTimers();
    try {
      const cache = new TtlCache<number>(20_000);
      const read = vi.fn(async () => 1);

      await cache.get('room', read);
      await cache.get('room', read);
      expect(read).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(20_001);
      await cache.get('room', read);
      expect(read).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * A cached failure is the dangerous shape: one Sync request that happens to
   * fail would answer the whole room generically for a full window.
   */
  it('does not cache a rejected read', async () => {
    const cache = new TtlCache<string>(60_000);
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error('Sync is having a moment'))
      .mockResolvedValueOnce('the room');

    await expect(cache.get('room', read)).rejects.toThrow('Sync is having a moment');
    expect(await cache.get('room', read)).toBe('the room');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('shares a rejection with the callers already waiting on it', async () => {
    const cache = new TtlCache<string>(60_000);
    const held = gate<string>();
    const read = vi.fn(() => held.promise);

    const first = cache.get('room', read);
    const second = cache.get('room', read);
    held.fail(new Error('nope'));

    await expect(first).rejects.toThrow('nope');
    await expect(second).rejects.toThrow('nope');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('forgets a key on invalidate', async () => {
    const cache = new TtlCache<number>(60_000);
    const read = vi.fn(async () => 1);
    await cache.get('room', read);
    cache.invalidate('room');
    await cache.get('room', read);
    expect(read).toHaveBeenCalledTimes(2);
  });

  /** A long-lived process must not grow one entry per caller it has ever seen. */
  it('evicts the oldest entries beyond its bound', async () => {
    const cache = new TtlCache<number>(60_000);
    const read = vi.fn(async () => 1);
    for (let i = 0; i < 600; i++) await cache.get(`k${i}`, read);

    // The first key is long gone; the most recent is still there.
    await cache.get('k0', read);
    expect(read).toHaveBeenCalledTimes(601);
    await cache.get('k599', read);
    expect(read).toHaveBeenCalledTimes(601);
  });
});

describe('memoizeByRef', () => {
  it('computes once per object, not once per call', () => {
    const fold = vi.fn((list: string[]) => list.length);
    const memo = memoizeByRef(fold);
    const room = ['a', 'b'];

    expect(memo(room)).toBe(2);
    expect(memo(room)).toBe(2);
    expect(fold).toHaveBeenCalledTimes(1);
  });

  it('recomputes for a different object with the same contents', () => {
    const fold = vi.fn((list: string[]) => list.length);
    const memo = memoizeByRef(fold);
    memo(['a']);
    memo(['a']);
    expect(fold).toHaveBeenCalledTimes(2);
  });
});
