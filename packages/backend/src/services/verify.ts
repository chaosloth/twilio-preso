import Twilio from 'twilio';
import { config } from '../config.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

export async function lookupPhone(phone: string): Promise<{ valid: boolean; formatted: string }> {
  // Basic format check — must start with + and have at least 10 digits
  const digits = phone.replace(/[^\d]/g, '');
  if (!phone.startsWith('+') || digits.length < 10) {
    return { valid: false, formatted: phone };
  }

  try {
    const lookup = await client.lookups.v2.phoneNumbers(phone).fetch();
    return { valid: lookup.valid, formatted: lookup.phoneNumber };
  } catch {
    // If Lookup API fails (permissions, etc.), trust the format check
    return { valid: true, formatted: phone };
  }
}

export async function startVerification(phone: string): Promise<void> {
  if (config.dev.bypassVerify) {
    console.log(`[dev] Verify bypass enabled — skipping SMS to ${phone}. Use code "${config.dev.bypassCode}".`);
    return;
  }
  await client.verify.v2
    .services(config.twilio.verifyServiceSid)
    .verifications.create({ to: phone, channel: 'sms' });
}

export async function checkVerification(phone: string, code: string): Promise<boolean> {
  if (config.dev.bypassVerify) {
    return code === config.dev.bypassCode;
  }
  const check = await client.verify.v2
    .services(config.twilio.verifyServiceSid)
    .verificationChecks.create({ to: phone, code });
  return check.status === 'approved';
}
