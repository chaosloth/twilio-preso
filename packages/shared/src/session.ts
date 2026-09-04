import type { Deck } from './deck.js';

export type SessionStatus = 'draft' | 'live' | 'ended';

/**
 * One presentation. Stored in the `sessions` control-plane SyncMap, keyed by
 * `joinCode` — the value the audience actually types, so a join is one map
 * read rather than a scan.
 */
export interface SessionRecord {
  /** Opaque uuid. Appears in Sync object names and tokens, never on screen. */
  id: string;
  joinCode: string;
  title: string;
  /** Allowlist entry that created it. Provenance, not permission — any
   *  allowlisted presenter may drive any session (co-presenting is a primary
   *  use case). */
  ownerPhone: string;
  /**
   * A self-contained snapshot, not a reference to a shared deck. Editing the
   * default deck must not retroactively change what a past session showed.
   */
  deck: Deck;
  /** Claimed from `TWILIO_PHONE_POOL` at creation, released on end. */
  phoneNumber: string;
  status: SessionStatus;
  createdAt: number;
  endedAt?: number;
}

/** Everything the public join-code lookup is allowed to reveal. */
export interface PublicSession {
  sessionId: string;
  title: string;
  status: SessionStatus;
}

export function toPublicSession(session: SessionRecord): PublicSession {
  return { sessionId: session.id, title: session.title, status: session.status };
}

/** A presenter permitted to sign in. Keyed by E.164 phone. */
export interface PresenterRecord {
  name: string;
  /** Phone of the presenter who added them, or 'bootstrap' for seeded entries. */
  addedBy: string;
  addedAt: number;
}

export interface PhonePoolClaim {
  sessionId: string;
  claimedAt: number;
}

/** Reported with a 409 when the pool is exhausted, so the presenter can see
 *  which event is holding what rather than just being told "no". */
export interface PhonePoolUsage {
  phoneNumber: string;
  sessionId: string;
  sessionTitle: string;
  joinCode: string;
}
