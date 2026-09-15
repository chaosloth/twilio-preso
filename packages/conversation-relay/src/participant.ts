import Twilio from 'twilio';
import { syncNames } from '@twilio-preso/shared';
import type { Participant } from '@twilio-preso/shared';
import { config } from './config.js';
import { TtlCache } from './cache.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);
const syncService = client.sync.v1.services(config.twilio.syncServiceSid);

/**
 * How long a room's participant list is reused.
 *
 * The whole mass finale is placed inside a second or two, so this only has to
 * cover a burst — and it must stay short enough that someone who registered
 * moments before the calls go out is still greeted by name rather than as a
 * stranger for the rest of the talk.
 */
const PARTICIPANTS_TTL_MS = 20_000;

const rooms = new TtlCache<Participant[]>(PARTICIPANTS_TTL_MS);

/** For a test, or a presenter who has just reset the session. */
export function forgetParticipants(sessionId?: string): void {
  if (sessionId) rooms.invalidate(sessionId);
  else rooms.clear();
}

/**
 * Find the attendee in *this session's* participants map.
 *
 * The map is per-session and prefixed, so a phone that attended two events is
 * greeted with the answers it gave at the event it is currently on the phone
 * about, and a number registered at neither is simply unknown.
 *
 * Cached and single-flighted per session: the finale rings the whole room at
 * once and every one of those calls wants this same list, so uncached it is one
 * five-hundred-item read per ringing phone. The cache returns one array instance
 * to all of them, which is also what lets the room tally be computed once.
 */
export async function listParticipants(sessionId: string): Promise<Participant[]> {
  try {
    return await rooms.get(sessionId, () => readParticipants(sessionId));
  } catch (err) {
    console.error(`Failed to read participants in session ${sessionId}:`, err);
    return [];
  }
}

/**
 * Deliberately lets its failures out, unlike the caller above.
 *
 * A read that returned `[]` on error would be cached as a *successful* empty
 * room, and every call for the next twenty seconds would be greeted generically
 * because one Sync request happened to fail. The cache drops a rejected read, so
 * throwing here is what makes the next caller retry; the boundary above is where
 * the failure becomes "less context on a working call".
 */
async function readParticipants(sessionId: string): Promise<Participant[]> {
  const mapName = syncNames(sessionId).participants;
  const items = await syncService.syncMaps(mapName).syncMapItems.list({ limit: 500 });
  return items.map((item) => item.data as Participant);
}
