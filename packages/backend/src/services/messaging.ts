import Twilio from 'twilio';
import { config } from '../config.js';
import { renderTemplate } from '@twilio-preso/shared';
import type { Participant } from '@twilio-preso/shared';
import { approvedContentSid, contentVariablesJson } from './content.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

/**
 * Every send names the session's own claimed pool number as `from`, replacing
 * the account-wide Messaging Service sender. A shared sender would put two
 * concurrent events on the same number, and both the voice agent and any inbound
 * reply identify a session by the number that was contacted — so a shared sender
 * makes the two events indistinguishable.
 *
 * The trade-off: `from` and `messagingServiceSid` are mutually exclusive, so
 * sending this way gives up the service's sticky sender and sender-pool
 * selection. Per-session routing is worth more than either here.
 */
export async function sendSms(from: string, to: string, body: string): Promise<void> {
  await client.messages.create({ from, to, body });
}

/**
 * One message, named by the content template it is written in.
 *
 * A body is never passed around any more: the SMS text is *rendered* from the
 * same template the WhatsApp send uses, so the approved WhatsApp copy and the SMS
 * copy cannot drift apart — and the values are the same list either way.
 */
export interface OutboundMessage {
  template: string;
  values: string[];
}

/**
 * Which channel a trigger asks for. `whatsapp` always means "WhatsApp if it can,
 * SMS if it can't" — see `sendOnChannel`.
 */
export type MessageChannel = 'sms' | 'whatsapp';

/** What actually happened, per participant, so a trigger can report it. */
export interface ChannelResult {
  whatsapp: number;
  sms: number;
  failed: number;
}

/** Twilio's error for a business-initiated free-form WhatsApp message sent
 *  outside the 24-hour customer service window. The expected failure, not an
 *  exceptional one: an attendee who has never messaged the sender is outside it
 *  by definition, which is why the fallback exists at all. */
const WHATSAPP_OUTSIDE_WINDOW = 63016;

export function isWhatsAppConfigured(): boolean {
  return !!config.twilio.whatsappFrom;
}

/**
 * Sends one message on the requested channel, falling back to SMS.
 *
 * Twilio's automatic channel fallback lives in the Bulk Messaging API
 * (`comms.twilio.com/v1/Messages`, with a sender pool and a channel priority
 * list), not on the classic Messages API this app uses for its per-session
 * `from`. So the fallback is application-level: try WhatsApp, and on *any*
 * failure send the same body as SMS.
 *
 * Falling back on any error rather than only on 63016 is deliberate. A room full
 * of attendees will produce unregistered numbers, opt-outs and template
 * rejections as well as closed windows, and the presenter's requirement is the
 * same in every case — the message has to arrive.
 */
export async function sendOnChannel(
  channel: MessageChannel,
  smsFrom: string,
  to: string,
  message: OutboundMessage
): Promise<'whatsapp' | 'sms'> {
  const body = renderTemplate(message.template, message.values);
  const whatsappFrom = config.twilio.whatsappFrom;
  if (channel === 'sms' || !whatsappFrom) {
    await sendSms(smsFrom, to, body);
    return 'sms';
  }

  /**
   * WhatsApp goes out as the approved template when there is one. Free-form text
   * is only delivered inside the 24-hour customer service window, and an attendee
   * who has never messaged this sender is outside it — so without a template the
   * WhatsApp attempt is one that is expected to fail into the SMS below, and with
   * one it reaches a phone that has never opened the chat.
   */
  const contentSid = approvedContentSid(message.template);
  try {
    await client.messages.create(
      contentSid
        ? {
            from: whatsappFrom,
            to: `whatsapp:${to}`,
            contentSid,
            // A JSON-encoded string on the Messages API, not an object.
            contentVariables: contentVariablesJson(message.values),
          }
        : { from: whatsappFrom, to: `whatsapp:${to}`, body }
    );
    return 'whatsapp';
  } catch (err: any) {
    const code = err?.code;
    console.warn(
      code === WHATSAPP_OUTSIDE_WINDOW
        ? `WhatsApp to ${to} is outside the 24-hour window (63016) — sending as SMS`
        : `WhatsApp to ${to} failed (${code ?? 'unknown'}) — sending as SMS`
    );
    await sendSms(smsFrom, to, body);
    return 'sms';
  }
}

/** The same body to everyone, on the requested channel, with per-recipient
 *  fallback: one attendee outside the WhatsApp window must not drop the room to
 *  SMS, and one hard failure must not stop the rest. */
export async function sendToAllOnChannel(
  channel: MessageChannel,
  smsFrom: string,
  participants: Participant[],
  messageFn: (p: Participant) => OutboundMessage
): Promise<ChannelResult> {
  const results = await Promise.allSettled(
    participants.map((p) => sendOnChannel(channel, smsFrom, p.phone, messageFn(p)))
  );

  const tally: ChannelResult = { whatsapp: 0, sms: 0, failed: 0 };
  for (const result of results) {
    if (result.status === 'rejected') tally.failed++;
    else tally[result.value]++;
  }
  return tally;
}

export async function sendWelcomeSms(from: string, participant: Participant): Promise<void> {
  await sendSms(from, participant.phone, renderTemplate('welcome', [participant.name]));
}

