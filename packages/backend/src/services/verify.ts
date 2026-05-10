import Twilio from 'twilio';
import { config } from '../config.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

export async function lookupPhone(phone: string): Promise<{ valid: boolean; formatted: string }> {
  try {
    const lookup = await client.lookups.v2.phoneNumbers(phone).fetch();
    return { valid: lookup.valid, formatted: lookup.phoneNumber };
  } catch {
    return { valid: false, formatted: phone };
  }
}

export async function startVerification(phone: string): Promise<void> {
  await client.verify.v2
    .services(config.twilio.verifyServiceSid)
    .verifications.create({ to: phone, channel: 'sms' });
}

export async function checkVerification(phone: string, code: string): Promise<boolean> {
  const check = await client.verify.v2
    .services(config.twilio.verifyServiceSid)
    .verificationChecks.create({ to: phone, code });
  return check.status === 'approved';
}
