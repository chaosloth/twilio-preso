/**
 * How the backend talks to a whole room at once without being throttled.
 *
 * Every mass trigger used to be `Promise.allSettled(participants.map(…))` — one
 * unbounded burst of as many API requests as there are attendees. At a dozen
 * people that is fine and is why it survived this long. At three hundred it is
 * three hundred simultaneous requests against a per-account rate limit, so a
 * chunk of them come back 429, `allSettled` folds those into a quietly lower
 * count, and on stage that reads as "the finale half worked" with nothing in the
 * response saying why.
 *
 * So: a bounded pool, a retry on the failures that are *worth* retrying, and the
 * error codes reported rather than counted. The pool is deliberately small —
 * throughput here is capped by the carrier's calls-per-second on the sending
 * number long before it is capped by this, and a queue that respects the limit
 * finishes sooner than a burst that gets rejected and redialled.
 */

/** In flight at once. Well inside a per-account REST limit, and overridable for
 *  an event whose account has had its limits raised. */
const DEFAULT_CONCURRENCY = 25;

/** Attempts *after* the first. Three is enough to ride out a burst of 429s
 *  without holding the finale open for a number that is simply unreachable. */
const DEFAULT_RETRIES = 3;

export interface FanOutFailure {
  /** Which item failed, by position in the input. */
  index: number;
  /** Twilio's own error code where there is one — `21610`, `20429`, … */
  code: string | number | null;
  status: number | null;
  message: string;
}

export interface FanOutResult<O> {
  /** One entry per item that succeeded, in completion order. */
  results: O[];
  failures: FanOutFailure[];
}

export interface FanOutOptions {
  concurrency?: number;
  retries?: number;
  /** Injected in tests so a retry does not really sleep. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Run `worker` over `items` with at most `concurrency` in flight.
 *
 * Workers are pulled from a shared cursor rather than sliced into batches: a
 * batch of twenty-five runs only as fast as its slowest member, and one attendee
 * whose call takes four seconds would hold back the twenty-four behind them.
 */
export async function fanOut<I, O>(
  items: I[],
  worker: (item: I, index: number) => Promise<O>,
  options: FanOutOptions = {}
): Promise<FanOutResult<O>> {
  const concurrency = Math.max(1, options.concurrency ?? envConcurrency() ?? DEFAULT_CONCURRENCY);
  const retries = options.retries ?? DEFAULT_RETRIES;
  const sleep = options.sleep ?? realSleep;

  const results: O[] = [];
  const failures: FanOutFailure[] = [];
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      try {
        results.push(await attempt(() => worker(items[index], index), retries, sleep));
      } catch (err) {
        failures.push(describeFailure(index, err));
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run())
  );

  return { results, failures };
}

/**
 * Retries only what a retry can fix: a rate limit or a transient server error.
 *
 * An invalid number or an unsubscribed recipient fails the same way three more
 * times, and retrying it costs the rest of the room its place in the queue.
 */
async function attempt<O>(
  work: () => Promise<O>,
  retries: number,
  sleep: (ms: number) => Promise<void>
): Promise<O> {
  for (let attemptNo = 0; ; attemptNo++) {
    try {
      return await work();
    } catch (err) {
      if (attemptNo >= retries || !isRetryable(err)) throw err;
      // Exponential, with jitter: a room's worth of workers that all back off
      // for exactly 250ms simply re-collide 250ms later.
      const base = 250 * 2 ** attemptNo;
      await sleep(base + Math.random() * base);
    }
  }
}

function isRetryable(err: any): boolean {
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  const code = Number(err?.code ?? 0);
  // 20429 is Twilio's own "Too Many Requests"; 429 is the HTTP status carrying it.
  return status === 429 || status >= 500 || code === 20429;
}

function describeFailure(index: number, err: any): FanOutFailure {
  return {
    index,
    code: err?.code ?? null,
    status: Number(err?.status ?? err?.statusCode) || null,
    message: String(err?.message ?? err ?? 'unknown error'),
  };
}

/**
 * The distinct error codes and how many hit each, for a response a presenter can
 * act on. Three hundred failures is one line — "20429 × 118" says throttled,
 * where a count of successes says nothing at all.
 */
export function summarizeFailures(failures: FanOutFailure[]): Record<string, number> {
  const byCode: Record<string, number> = {};
  for (const f of failures) {
    const key = String(f.code ?? f.status ?? 'unknown');
    byCode[key] = (byCode[key] ?? 0) + 1;
  }
  return byCode;
}

function envConcurrency(): number | undefined {
  const raw = Number(process.env.TWILIO_FANOUT_CONCURRENCY);
  return Number.isFinite(raw) && raw > 0 ? raw : undefined;
}

const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
