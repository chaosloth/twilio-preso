/**
 * The reads a room full of simultaneous calls would otherwise duplicate.
 *
 * A mass finale rings every attendee at once, and every one of those calls needs
 * the *same* session record, the *same* participants map and the same tally of
 * what the room answered. Uncached, three hundred ringing phones are three
 * hundred full-collection Sync reads inside a second or two — O(calls ×
 * participants) — which is the shape that rate-limits the control plane and
 * turns the finale into dead air on half the handsets.
 *
 * Two things are needed and they are not the same:
 *
 * - **single-flight**, so the three hundred setups that arrive together share
 *   one in-flight request rather than racing three hundred of their own. This is
 *   the property that actually collapses the burst; the TTL only helps calls
 *   that arrive after the first has finished.
 * - **a short TTL**, long enough to cover a burst and short enough that an
 *   attendee who registered thirty seconds ago is still greeted by name.
 *
 * Failures are never cached: a transient Sync error must not become thirty
 * seconds of generic greetings. The rejected promise is dropped as soon as it
 * settles, so the next caller retries.
 */

interface Entry<T> {
  /** Present from the moment the read starts, so concurrent callers can share it. */
  promise: Promise<T>;
  /** Set once it resolves — an in-flight entry has no age yet, and must not be
   *  expired out from under the callers already awaiting it. */
  resolvedAt?: number;
}

/**
 * Bounded so a long-lived process cannot grow one entry per profile seen. Well
 * above the number of sessions or callers in flight at once, so eviction only
 * ever touches entries a live call has finished with.
 */
const MAX_ENTRIES = 500;

export class TtlCache<T> {
  private entries = new Map<string, Entry<T>>();

  constructor(private readonly ttlMs: number) {}

  /**
   * The cached value for `key`, or `read()`'s — shared with every caller that
   * asks while it is still in flight.
   */
  get(key: string, read: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && !this.isStale(hit)) return hit.promise;

    const entry: Entry<T> = {
      promise: read().then(
        (value) => {
          // Only stamp the entry that is still the current one: a read that
          // resolves after its key was invalidated must not resurrect itself.
          if (this.entries.get(key) === entry) entry.resolvedAt = Date.now();
          return value;
        },
        (err) => {
          if (this.entries.get(key) === entry) this.entries.delete(key);
          throw err;
        }
      ),
    };

    this.entries.set(key, entry);
    this.evictIfFull();
    return entry.promise;
  }

  /** Drop a key — for a session whose state is known to have changed. */
  invalidate(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  private isStale(entry: Entry<T>): boolean {
    // In flight: not stale at any age. Its awaiters are already waiting on it,
    // and starting a second identical read is the duplication this exists to stop.
    if (entry.resolvedAt === undefined) return false;
    return Date.now() - entry.resolvedAt > this.ttlMs;
  }

  /** Oldest insertion first — `Map` iterates in insertion order. */
  private evictIfFull(): void {
    while (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next();
      if (oldest.done) return;
      this.entries.delete(oldest.value);
    }
  }
}

/**
 * Memoize a pure function of one object, keyed on the object's **identity**.
 *
 * For the room tally, which is CPU rather than a round trip: folding five
 * hundred participants' responses once per ringing phone is real work on a
 * shared vCPU. Because the participants list above is cached, every call in a
 * burst is handed the *same array instance*, so identity is exactly the right
 * key — one tally per underlying read, with no TTL to keep in step with the
 * list's own and no way for the two to disagree.
 *
 * `WeakMap`, so a superseded list is collected with its tally rather than held.
 */
export function memoizeByRef<A extends object, R>(fn: (arg: A) => R): (arg: A) => R {
  const seen = new WeakMap<A, R>();
  return (arg: A): R => {
    const hit = seen.get(arg);
    if (hit !== undefined) return hit;
    const value = fn(arg);
    seen.set(arg, value);
    return value;
  };
}
