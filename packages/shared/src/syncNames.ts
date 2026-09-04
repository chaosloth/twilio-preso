/**
 * The one place the per-session Sync object naming convention lives.
 *
 * The Sync service is split into a control plane (stable, unprefixed objects:
 * `presenter-allowlist`, `sessions`, `phone-pool-claims`) and a data plane —
 * these four objects, prefixed per session. Prefixing is what makes `isLive`
 * per-session, so a presenter rehearsing cannot send real SMS on behalf of a
 * colleague running live.
 */
export interface SyncObjectNames {
  state: string;
  aggregate: string;
  events: string;
  participants: string;
}

/** Underscore separates the prefix from the object name, so ids may not contain one. */
const VALID_SESSION_ID = /^[A-Za-z0-9-]+$/;

export function syncNames(sessionId: string): SyncObjectNames {
  if (!VALID_SESSION_ID.test(sessionId.trim()) || sessionId.trim() !== sessionId) {
    throw new Error(
      `Invalid session id ${JSON.stringify(sessionId)}: expected a non-empty id of letters, digits and dashes.`,
    );
  }

  return {
    state: `s_${sessionId}_presentation-state`,
    aggregate: `s_${sessionId}_aggregate-results`,
    events: `s_${sessionId}_event-stream`,
    participants: `s_${sessionId}_participants`,
  };
}
