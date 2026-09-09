import { countryCodeFor, offeredCountryCodesFor } from './countryCodes.js';
import type { Deck } from './deck.js';
import type { RelayConfig } from './relayConfig.js';

export type SessionStatus = 'draft' | 'live' | 'ended';

/** How the registration passcode reaches a phone. */
export type VerifyChannel = 'whatsapp' | 'sms';

export const VERIFY_CHANNELS: readonly VerifyChannel[] = ['whatsapp', 'sms'];

/** WhatsApp — it is the channel this talk is about, and the identity the
 *  attendee's profile is built from. */
export const DEFAULT_VERIFY_CHANNEL: VerifyChannel = 'whatsapp';

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
  /**
   * Voice-agent settings for this presentation, as a **partial**: only what the
   * presenter changed in the HUD. Read through `resolveRelayConfig`, never
   * directly, so a session created before a field existed still gets its
   * default. Absent means "everything default".
   */
  relay?: Partial<RelayConfig>;
  /**
   * Which channel registration offers first for the one-time passcode. A room
   * whose WhatsApp sender is not ready needs SMS, and that is a property of the
   * event rather than of the build — so it is stored here and the phone is told.
   * Absent means the default.
   */
  verifyChannel?: VerifyChannel;
  /**
   * The dialling code the registration screen starts on, e.g. `+65` in
   * Singapore. A property of the room, not of the build: a Singapore audience
   * typing local numbers against an Australian default registers nobody, and
   * the fix cannot be one attendee at a time. Absent means the default.
   */
  countryCode?: string;
  /**
   * Which dialling codes the registration screen offers at all. Absent or empty
   * means every one this build knows — narrowing it is how a room stops being a
   * list of two hundred options, and never how it stops being usable, so the
   * resolved default is offered whatever this says.
   */
  countryCodes?: string[];
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
  /**
   * The session's claimed pool number, in E.164. Public on purpose: the call-in
   * and WhatsApp stages invite the room to contact it, and a phone cannot build
   * a `tel:` or `wa.me` link for a number it has not been told. It is a Twilio
   * number owned by the event, never a person's.
   */
  phoneNumber: string;
  /** Which channel the registration screen offers first. */
  verifyChannel: VerifyChannel;
  /** The dialling code the registration screen starts on. */
  countryCode: string;
  /** The dialling codes it offers. Resolved, so it always contains the one
   *  above. */
  countryCodes: string[];
}

/**
 * Resolved rather than read: the field is optional on the record, and a
 * hand-edited session must not be able to ask Verify for a channel it does not
 * have — an unrecognised value is the default, not an error at the door.
 */
export function verifyChannelFor(session: SessionRecord): VerifyChannel {
  return VERIFY_CHANNELS.includes(session.verifyChannel as VerifyChannel)
    ? (session.verifyChannel as VerifyChannel)
    : DEFAULT_VERIFY_CHANNEL;
}

export function toPublicSession(session: SessionRecord): PublicSession {
  return {
    sessionId: session.id,
    title: session.title,
    status: session.status,
    phoneNumber: session.phoneNumber,
    verifyChannel: verifyChannelFor(session),
    countryCode: countryCodeFor(session),
    countryCodes: offeredCountryCodesFor(session).map((c) => c.code),
  };
}

/** A presenter permitted to sign in. Keyed by E.164 phone. */
export interface PresenterRecord {
  name: string;
  /** Phone of the presenter who added them, or 'bootstrap' for seeded entries. */
  addedBy: string;
  addedAt: number;
}

/** An allowlist entry with its map key folded in — the shape `GET /api/presenters` returns. */
export interface Presenter extends PresenterRecord {
  phone: string;
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
