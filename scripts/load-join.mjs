#!/usr/bin/env node
/**
 * Load test against a *deployed* backend: N phones resolving a join code.
 *
 *   node scripts/load-join.mjs <backend-origin> <JOINCODE> [room=300] [gapMs=5]
 *
 * Only the join-code lookup (`GET /api/session/:code`) — the step that refused
 * the room at the last event, and the one public step that is read-only. The
 * rest of the join sends real OTPs and writes participants, so it is covered by
 * the in-process test (packages/backend/src/__tests__/load) instead.
 *
 * Every request comes from this machine, which is the point: before the fix,
 * Fly's proxy made a whole room look like one address, so one machine was an
 * exact model of a room. After it, this machine is one attendee — and should be
 * refused after ten, which is the limit still doing its job.
 */
const [origin, code, roomArg = '300', gapArg = '5'] = process.argv.slice(2);
if (!origin || !code) {
  console.error('usage: load-join.mjs <origin> <JOINCODE> [room] [gapMs]');
  process.exit(2);
}
const room = Number(roomArg);
const gap = Number(gapArg);
const statuses = {};
const started = Date.now();
const latencies = [];
await Promise.all(
  Array.from({ length: room }, (_, i) =>
    new Promise((r) => setTimeout(r, i * gap)).then(async () => {
      const t = Date.now();
      let status;
      try {
        status = (await fetch(`${origin}/api/session/${code}`)).status;
      } catch {
        status = 'network';
      }
      latencies.push(Date.now() - t);
      statuses[status] = (statuses[status] ?? 0) + 1;
    })
  )
);
latencies.sort((a, b) => a - b);
const pct = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))];
console.log(JSON.stringify({ origin, room, statuses, p50: pct(0.5), p95: pct(0.95), totalMs: Date.now() - started }));
