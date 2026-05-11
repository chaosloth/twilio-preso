import Twilio from 'twilio';
import { config } from './config.js';
import type { Participant } from '@twilio-preso/shared';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);
const syncService = client.sync.v1.services(config.twilio.syncServiceSid);
const PARTICIPANTS_MAP = 'participants';

export async function lookupParticipantByPhone(phone: string): Promise<Participant | null> {
  try {
    const items = await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems.list({ limit: 500 });
    const normalized = normalizePhone(phone);
    const match = items.find((item) => {
      const data = item.data as Participant;
      return normalizePhone(data.phone) === normalized;
    });
    return match ? (match.data as Participant) : null;
  } catch (err) {
    console.error('Failed to lookup participant:', err);
    return null;
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}
