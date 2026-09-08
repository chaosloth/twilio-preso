import Twilio from 'twilio';
import { syncNames } from '@twilio-preso/shared';
import type { Participant } from '@twilio-preso/shared';
import { config } from './config.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);
const syncService = client.sync.v1.services(config.twilio.syncServiceSid);

/**
 * Find the attendee in *this session's* participants map.
 *
 * The map is per-session and prefixed, so a phone that attended two events is
 * greeted with the answers it gave at the event it is currently on the phone
 * about, and a number registered at neither is simply unknown.
 */
export async function listParticipants(sessionId: string): Promise<Participant[]> {
  try {
    const mapName = syncNames(sessionId).participants;
    const items = await syncService.syncMaps(mapName).syncMapItems.list({ limit: 500 });
    return items.map((item) => item.data as Participant);
  } catch (err) {
    console.error(`Failed to read participants in session ${sessionId}:`, err);
    return [];
  }
}

/**
 * The caller, out of a room already in hand.
 *
 * Takes the list rather than fetching one, because setup needs the whole room
 * anyway — the aggregate answers are what the finale talks about — and a second
 * list of five hundred items is latency on a ringing phone for data already read.
 */
export function findParticipantByPhone(
  participants: Participant[],
  phone: string
): Participant | null {
  const normalized = normalizePhone(phone);
  return participants.find((p) => normalizePhone(p.phone) === normalized) ?? null;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}
