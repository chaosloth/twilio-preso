import Twilio from 'twilio';
import { config } from '../config.js';
import type { Participant } from '@twilio-preso/shared';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

export async function sendWelcomeSms(participant: Participant): Promise<void> {
  await client.messages.create({
    to: participant.phone,
    messagingServiceSid: config.twilio.messagingServiceSid,
    body: `Welcome to SIGNAL, ${participant.name}! You're now part of the live demo. Keep your phone handy — we'll be in touch.`,
  });
}

export async function sendSmsToParticipant(phone: string, body: string): Promise<void> {
  await client.messages.create({
    to: phone,
    messagingServiceSid: config.twilio.messagingServiceSid,
    body,
  });
}

export async function sendSmsToAll(participants: Participant[], bodyFn: (p: Participant) => string): Promise<void> {
  await Promise.allSettled(
    participants.map((p) => sendSmsToParticipant(p.phone, bodyFn(p)))
  );
}
