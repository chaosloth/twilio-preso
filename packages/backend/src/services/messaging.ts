import Twilio from 'twilio';
import { config } from '../config.js';
import type { Participant } from '@twilio-preso/shared';

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

export async function sendWelcomeSms(from: string, participant: Participant): Promise<void> {
  await sendSms(
    from,
    participant.phone,
    `Welcome to Wonder, ${participant.name}! You're now part of the live demo. Keep your phone handy — we'll be in touch.`
  );
}

export async function sendSmsToParticipant(
  from: string,
  phone: string,
  body: string
): Promise<void> {
  await sendSms(from, phone, body);
}

export async function sendSmsToAll(
  from: string,
  participants: Participant[],
  bodyFn: (p: Participant) => string
): Promise<void> {
  await Promise.allSettled(participants.map((p) => sendSms(from, p.phone, bodyFn(p))));
}
