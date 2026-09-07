import Twilio from 'twilio';
import type { PhonePoolClaim } from '@twilio-preso/shared';
import { config } from './config.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);
const syncService = client.sync.v1.services(config.twilio.syncServiceSid);

/** Control plane — unprefixed, shared by every session. */
const PHONE_POOL_CLAIMS = 'phone-pool-claims';

/** The fields of the ConversationRelay `setup` message this server reads. */
export interface SetupEvent {
  from?: string;
  to?: string;
  direction?: string;
  customParameters?: Record<string, string>;
}

export interface CallSession {
  sessionId: string;
  /** The attendee's number — whichever end of the call is not the session's own. */
  participantPhone: string | null;
}

/**
 * Work out which presentation a call belongs to.
 *
 * Preferred path: the TwiML carries `<Parameter name="sessionId">`, so the
 * backend — which already knows the session — states it outright.
 *
 * Fallback: infer it from the session's claimed pool number. Which end of the
 * call that is depends on direction, and getting it backwards silently looks up
 * the wrong party: on an outbound call Twilio dials *from* the pool number and
 * the attendee is `to`; on an inbound call the attendee rang *in*, so it is the
 * other way round.
 */
export async function resolveSession(event: SetupEvent): Promise<CallSession | null> {
  const outbound = event.direction?.startsWith('outbound') ?? false;
  const sessionPhone = outbound ? event.from : event.to;
  const participantPhone = (outbound ? event.to : event.from) ?? null;

  const declared = event.customParameters?.sessionId;
  if (declared) return { sessionId: declared, participantPhone };

  if (!sessionPhone) return null;
  const sessionId = await sessionIdForPhoneNumber(sessionPhone);
  return sessionId ? { sessionId, participantPhone } : null;
}

/** Reverse lookup: this server only knows phone numbers, not session ids. */
async function sessionIdForPhoneNumber(phoneNumber: string): Promise<string | null> {
  try {
    const item = await syncService.syncMaps(PHONE_POOL_CLAIMS).syncMapItems(phoneNumber).fetch();
    return (item.data as PhonePoolClaim).sessionId;
  } catch {
    return null;
  }
}
