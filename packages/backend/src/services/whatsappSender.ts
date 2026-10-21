import Twilio from 'twilio';
import { config } from '../config.js';

/**
 * Which WhatsApp sender a session's messages go out from.
 *
 * The session's **own claimed pool number**, when that number is a registered
 * WhatsApp sender in this account. That is the rule SMS already follows, and for
 * the same reason: an attendee replies to the number that wrote to them, and both
 * the text agent and the voice agent identify a session by that number — a
 * WhatsApp message from another session's number puts the reply in the wrong
 * event.
 *
 * `TWILIO_WHATSAPP_FROM` is the fallback for a session whose pool number has no
 * WhatsApp registration — but **never when it is another pool number**. In an
 * environment whose WhatsApp sender is also one of its pool numbers, the global
 * sender *is* some other session's number whenever this session claimed a
 * different one; using it is the bug this module exists to fix. Such a session
 * gets `''` and its WhatsApp triggers send as SMS, from its own number — the
 * message still arrives, from the right event.
 */

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

/** A sender list changes when someone registers a number with Meta — rarely,
 *  and never mid-talk — so it is read once a few minutes rather than per send. */
const TTL_MS = 5 * 60_000;
let cached: { at: number; senders: Promise<Set<string>> } | null = null;

export const whatsappAddress = (phone: string): string =>
  phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;

/** The `whatsapp:+E164` senders this account has registered. */
export function registeredWhatsAppSenders(): Promise<Set<string>> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.senders;
  const senders = client.messaging.v2.channelsSenders
    // `channel` is required by the API, not optional — a bare list() throws.
    .list({ channel: 'whatsapp', limit: 100 })
    .then((list) => new Set(list.map((s) => s.senderId).filter(Boolean)));
  cached = { at: Date.now(), senders };
  // A failed read is never cached: a transient outage must not pin every
  // session to the fallback for five minutes.
  senders.catch(() => {
    if (cached?.senders === senders) cached = null;
  });
  return senders;
}

export function resetWhatsAppSenderCache(): void {
  cached = null;
}

/**
 * The pure rule, given the account's registered senders. `null` registrations
 * means the list could not be read — then the session's own number is still
 * preferred when it *is* the global sender, and otherwise only a global sender
 * that is not some other pool number is used.
 */
export function chooseWhatsAppSender(
  sessionNumber: string | undefined,
  registered: Set<string> | null,
  globalSender: string,
  pool: readonly string[]
): string {
  const own = sessionNumber ? whatsappAddress(sessionNumber) : '';
  if (own && registered?.has(own)) return own;
  if (own && own === globalSender) return own;
  if (!globalSender) return '';
  const globalIsAnotherSession = pool.some(
    (n) => whatsappAddress(n) === globalSender && whatsappAddress(n) !== own
  );
  return globalIsAnotherSession ? '' : globalSender;
}

/** The WhatsApp sender for a session's pool number, or `''` to send as SMS. */
export async function whatsappSenderFor(sessionNumber: string | undefined): Promise<string> {
  const registered = await registeredWhatsAppSenders().catch((err) => {
    console.warn('Could not list WhatsApp senders — choosing one without the list:', err?.message ?? err);
    return null;
  });
  return chooseWhatsAppSender(
    sessionNumber,
    registered,
    config.twilio.whatsappFrom,
    config.twilio.phonePool
  );
}
