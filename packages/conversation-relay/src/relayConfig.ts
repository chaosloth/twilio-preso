import Twilio from 'twilio';
import { directionOf, relayConfigFor, resolveRelayConfig } from '@twilio-preso/shared';
import type { CallDirection, RelayConfig, SessionRecord } from '@twilio-preso/shared';
import { config as env } from './config.js';
import { TtlCache } from './cache.js';

const client = Twilio(env.twilio.accountSid, env.twilio.authToken);
const syncService = client.sync.v1.services(env.twilio.syncServiceSid);

/**
 * Which of the session's two configs this call is answered with.
 *
 * The backend states it in `<Parameter name="direction">`, because it knows what
 * it placed; the setup message's own `direction` is the fallback, and describes
 * the leg Twilio dialled. The instructions, the greeting and the turn limit all
 * come from whichever this picks, so a wrong answer here is an outbound finale
 * introducing itself as if the attendee had rung in.
 */
export function callDirection(event: {
  direction?: string;
  customParameters?: Record<string, string>;
}): CallDirection {
  return directionOf(event.customParameters?.direction, event.direction);
}

/** Control plane — unprefixed, keyed by join code. */
const SESSIONS = 'sessions';

/**
 * How long the control-plane session list is reused.
 *
 * Longer than the participants TTL: a room gains attendees during the talk, but
 * the voice settings change only when a presenter saves the HUD's voice tab —
 * and a presenter who has just saved is about to place a test call, which is one
 * call and can wait half a minute to hear it. Every concurrent call shares this
 * one entry, so the whole map is read once per window rather than once per phone.
 */
const SESSIONS_TTL_MS = 30_000;

/**
 * One entry, not one per session: the expensive part is listing the map, and the
 * scan for an id is free once it is in hand. So a finale for one session and a
 * call into another are served by the same single read.
 */
const SESSIONS_KEY = 'all';

const sessions = new TtlCache<SessionRecord[]>(SESSIONS_TTL_MS);

/** For a test, or immediately after a save whose effect must be heard now. */
export function forgetSessions(): void {
  sessions.clear();
}

/**
 * This session's voice settings, read from the `sessions` control-plane map.
 *
 * Read over Sync rather than over HTTP for the same reason the participant and
 * pool-claim lookups are: this is a standalone process with its own env and no
 * route into the backend. The map is keyed by join code, not id, so the id is
 * matched over the (small — one entry per concurrent event) list.
 *
 * Cached and single-flighted, because the finale asks this question once per
 * ringing phone and the answer is the same for all of them.
 *
 * Every failure returns the defaults. A misconfigured or unreachable control
 * plane must leave a ringing phone with a working agent, not silence.
 */
export async function fetchSessionConfig(
  sessionId: string | null,
  direction: CallDirection = 'inbound'
): Promise<{ config: RelayConfig; session: SessionRecord | null }> {
  if (!sessionId) return { config: resolveRelayConfig(), session: null };
  try {
    const records = await sessions.get(SESSIONS_KEY, readSessions);
    const session = records.find((s) => s.id === sessionId) ?? null;
    return { config: relayConfigFor(session, direction), session };
  } catch (err) {
    console.error(`Failed to read voice settings for session ${sessionId}:`, err);
    return { config: resolveRelayConfig(), session: null };
  }
}

/** Throws on failure on purpose — see `readParticipants`. A cached failure here
 *  would answer the whole room in the shipped default voice for a full window. */
async function readSessions(): Promise<SessionRecord[]> {
  const items = await syncService.syncMaps(SESSIONS).syncMapItems.list({ limit: 200 });
  return items.map((item) => item.data as SessionRecord);
}
