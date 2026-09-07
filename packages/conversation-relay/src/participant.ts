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
export async function lookupParticipantByPhone(
  sessionId: string,
  phone: string
): Promise<Participant | null> {
  try {
    const mapName = syncNames(sessionId).participants;
    const items = await syncService.syncMaps(mapName).syncMapItems.list({ limit: 500 });
    const normalized = normalizePhone(phone);
    const match = items.find(
      (item) => normalizePhone((item.data as Participant).phone) === normalized
    );
    return match ? (match.data as Participant) : null;
  } catch (err) {
    console.error(`Failed to look up participant in session ${sessionId}:`, err);
    return null;
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}
