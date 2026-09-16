import Twilio from 'twilio';
import { config } from '../config.js';
import { expectedVoiceUrl } from './sessions.js';

/**
 * Whether an inbound **WhatsApp call** reaches this session's voice agent.
 *
 * WhatsApp Business Calling is not routed like a phone number. There is no
 * `voiceUrl` on the sender: inbound WhatsApp audio is routed by the sender's
 * `configuration.voice_application_sid` — a **TwiML Application** (`AP…`) — and
 * it is *that application's* Voice Request URL which finally receives the
 * webhook. So the check is two hops, and either can be wrong on its own:
 * the sender may name no application at all (WhatsApp calling is then simply
 * not activated — setting the sid is what activates it), or it may name an
 * application pointing at another environment.
 *
 * The failure this exists to catch is worse than the phone-number one. A
 * claimed number pointed at this backend without `?sessionId=` still works,
 * because the relay infers the session from the number that was called. On a
 * WhatsApp call it cannot: the setup message's `to` is `whatsapp:+E164`, while
 * `phone-pool-claims` is keyed by bare E.164, so the lookup misses and the
 * caller is answered in the shipped default voice with no session context at
 * all. For WhatsApp, `?sessionId=` is not an optimisation — it is the routing.
 */

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

export interface WhatsAppVoiceWebhook {
  /** `whatsapp:+E164` — the configured sender, whether or not it was found. */
  sender: string;
  /** The Sender resource (`XE…`), or null when this account has no such sender. */
  senderSid: string | null;
  /** `ONLINE`, `PENDING_VERIFICATION`, … as Twilio reports it. */
  senderStatus: string | null;
  /**
   * The TwiML Application inbound WhatsApp calls are routed to. `null` means
   * WhatsApp calling is not activated on this sender at all — a call to it is
   * rejected rather than misrouted.
   */
  applicationSid: string | null;
  applicationName: string | null;
  /** The application's Voice Request URL: what actually answers the call. */
  registered: string | null;
  expected: string;
  matches: boolean;
  /** Reaches this backend, but names no session — unrecoverable for WhatsApp. */
  reachesThisBackend: boolean;
}

export async function describeWhatsAppVoiceWebhook(
  sessionId: string
): Promise<WhatsAppVoiceWebhook> {
  const sender = config.twilio.whatsappFrom;
  const expected = expectedVoiceUrl(sessionId);
  const blank: WhatsAppVoiceWebhook = {
    sender,
    senderSid: null,
    senderStatus: null,
    applicationSid: null,
    applicationName: null,
    registered: null,
    expected,
    matches: false,
    reachesThisBackend: false,
  };
  if (!sender) return blank;

  // `channel` is required by the API, not optional — a bare list() throws.
  const senders = await client.messaging.v2.channelsSenders.list({
    channel: 'whatsapp',
    limit: 100,
  });
  const found = senders.find((s) => s.senderId === sender);
  if (!found) return blank;

  const applicationSid = (found.configuration as any)?.voiceApplicationSid ?? null;
  const withSender = {
    ...blank,
    senderSid: found.sid,
    senderStatus: (found.status as string) ?? null,
    applicationSid,
  };
  if (!applicationSid) return withSender;

  // Best-effort: an application sid this account cannot read still tells the
  // presenter that calling is activated, which is most of the answer.
  const app = await client.applications(applicationSid).fetch().catch(() => null);
  const registered = app?.voiceUrl || null;
  return {
    ...withSender,
    applicationName: app?.friendlyName ?? null,
    registered,
    matches: registered === expected,
    reachesThisBackend: !!registered && registered.split('?')[0] === expected.split('?')[0],
  };
}

/**
 * Points the sender's TwiML application at this session.
 *
 * The write is on the **application**, not the sender: the sender already names
 * it, and re-writing `voice_application_sid` would deactivate and reactivate
 * WhatsApp calling to change a URL. One consequence worth knowing before
 * pressing the button — the application is account-wide, so every WhatsApp
 * sender routed through it follows this session too. There is one per
 * environment here, which is why that is acceptable rather than surprising.
 */
export async function pointWhatsAppAtVoiceAgent(sessionId: string): Promise<void> {
  const current = await describeWhatsAppVoiceWebhook(sessionId);
  if (!current.applicationSid) {
    throw new Error(
      current.senderSid
        ? 'This WhatsApp sender has no voice application, so WhatsApp calling is not activated on it. Activating it is a Console/API change that outlives the event.'
        : `No WhatsApp sender ${current.sender} exists in this account.`
    );
  }
  await client
    .applications(current.applicationSid)
    .update({ voiceUrl: current.expected, voiceMethod: 'POST' });
}
