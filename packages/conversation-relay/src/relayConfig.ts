import Twilio from 'twilio';
import { directionOf, relayConfigFor, resolveRelayConfig } from '@twilio-preso/shared';
import type { CallDirection, RelayConfig, SessionRecord } from '@twilio-preso/shared';
import { config as env } from './config.js';

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
 * This session's voice settings, read from the `sessions` control-plane map.
 *
 * Read over Sync rather than over HTTP for the same reason the participant and
 * pool-claim lookups are: this is a standalone process with its own env and no
 * route into the backend. The map is keyed by join code, not id, so the id is
 * matched over the (small — one entry per concurrent event) list.
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
    const items = await syncService.syncMaps(SESSIONS).syncMapItems.list({ limit: 200 });
    const match = items.find((item) => (item.data as SessionRecord).id === sessionId);
    const session = match ? (match.data as SessionRecord) : null;
    return { config: relayConfigFor(session, direction), session };
  } catch (err) {
    console.error(`Failed to read voice settings for session ${sessionId}:`, err);
    return { config: resolveRelayConfig(), session: null };
  }
}
