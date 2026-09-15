import { describe, expect, it, vi } from 'vitest';
import { fanOut, summarizeFailures } from '../fanOut.js';

/** No real backoff: a retry test should not take two seconds. */
const noSleep = async () => {};

function twilioError(code: number, status: number, message = 'twilio said no') {
  return Object.assign(new Error(message), { code, status });
}

describe('fanOut', () => {
  it('never has more than the limit in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 300 }, (_, i) => i);

    const { results, failures } = await fanOut(
      items,
      async (item) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        return item;
      },
      { concurrency: 25, sleep: noSleep }
    );

    expect(peak).toBe(25);
    expect(results).toHaveLength(300);
    expect(failures).toEqual([]);
  });

  /**
   * Workers pull from a shared cursor rather than running in batches: one slow
   * recipient must not hold back the twenty-four queued behind them.
   */
  it('keeps working while one item is slow', async () => {
    const order: number[] = [];
    await fanOut(
      [0, 1, 2, 3],
      async (item) => {
        await new Promise((r) => setTimeout(r, item === 0 ? 30 : 1));
        order.push(item);
      },
      { concurrency: 2, sleep: noSleep }
    );
    // The slow first item finishes last despite starting first.
    expect(order[order.length - 1]).toBe(0);
  });

  it('retries a rate limit and reports the eventual success', async () => {
    const worker = vi
      .fn()
      .mockRejectedValueOnce(twilioError(20429, 429, 'Too Many Requests'))
      .mockResolvedValueOnce('CA123');

    const { results, failures } = await fanOut([1], worker, { sleep: noSleep });

    expect(worker).toHaveBeenCalledTimes(2);
    expect(results).toEqual(['CA123']);
    expect(failures).toEqual([]);
  });

  it('retries a 5xx', async () => {
    const worker = vi
      .fn()
      .mockRejectedValueOnce(twilioError(20500, 503))
      .mockResolvedValueOnce('ok');
    const { results } = await fanOut([1], worker, { sleep: noSleep });
    expect(results).toEqual(['ok']);
  });

  /**
   * An unreachable handset fails identically three more times, and retrying it
   * costs the rest of the room its place in the queue.
   */
  it('does not retry a permanent failure', async () => {
    const worker = vi.fn().mockRejectedValue(twilioError(21610, 400, 'unsubscribed'));

    const { results, failures } = await fanOut([1], worker, { sleep: noSleep });

    expect(worker).toHaveBeenCalledTimes(1);
    expect(results).toEqual([]);
    expect(failures).toEqual([
      { index: 0, code: 21610, status: 400, message: 'unsubscribed' },
    ]);
  });

  it('gives up after the retry budget and records the failure', async () => {
    const worker = vi.fn().mockRejectedValue(twilioError(20429, 429));
    const { failures } = await fanOut([1], worker, { retries: 2, sleep: noSleep });
    expect(worker).toHaveBeenCalledTimes(3);
    expect(failures).toHaveLength(1);
  });

  /** One bad number must not cost the rest of the room the finale. */
  it('completes the room around a failure', async () => {
    const { results, failures } = await fanOut(
      [1, 2, 3],
      async (item) => {
        if (item === 2) throw twilioError(21211, 400, 'not a number');
        return item;
      },
      { sleep: noSleep }
    );
    expect(results.sort()).toEqual([1, 3]);
    expect(failures.map((f) => f.index)).toEqual([1]);
  });

  it('does nothing, successfully, for an empty room', async () => {
    const worker = vi.fn();
    const { results, failures } = await fanOut([], worker, { sleep: noSleep });
    expect(worker).not.toHaveBeenCalled();
    expect(results).toEqual([]);
    expect(failures).toEqual([]);
  });
});

describe('summarizeFailures', () => {
  /** "20429 × 118" says throttled. A count of successes says nothing at all. */
  it('counts the distinct codes', () => {
    expect(
      summarizeFailures([
        { index: 0, code: 20429, status: 429, message: '' },
        { index: 1, code: 20429, status: 429, message: '' },
        { index: 2, code: 21610, status: 400, message: '' },
      ])
    ).toEqual({ '20429': 2, '21610': 1 });
  });

  it('falls back to the status, then to unknown', () => {
    expect(
      summarizeFailures([
        { index: 0, code: null, status: 502, message: '' },
        { index: 1, code: null, status: null, message: '' },
      ])
    ).toEqual({ '502': 1, unknown: 1 });
  });
});
