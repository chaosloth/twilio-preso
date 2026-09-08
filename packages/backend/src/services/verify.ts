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

/** How the code reaches them. WhatsApp is the default the audience app asks
 *  for — it is the channel this talk is about — but Verify only delivers on it
 *  when the service has a WhatsApp sender, so SMS remains the fallback. */
export type VerifyChannel = 'sms' | 'whatsapp';

/**
 * Sends the verification code, and reports which channel actually carried it.
 *
 * WhatsApp can fail for reasons that have nothing to do with the number — no
 * WhatsApp sender on the Verify service, a recipient who has never used
 * WhatsApp — and the one thing that must not happen at the door of a live event
 * is a phone that cannot get its code. So a WhatsApp failure retries as SMS
 * rather than surfacing, and the audience is told which one to look at.
 */
export async function startVerification(
  phone: string,
  channel: VerifyChannel = 'whatsapp'
): Promise<VerifyChannel> {
  if (config.dev.bypassVerify) {
    console.log(`[dev] Verify bypass enabled — skipping ${channel} to ${phone}. Use code "${config.dev.bypassCode}".`);
    return channel;
  }

  const send = (via: VerifyChannel) =>
    client.verify.v2
      .services(config.twilio.verifyServiceSid)
      .verifications.create({ to: phone, channel: via });

  try {
    await send(channel);
    return channel;
  } catch (err) {
    if (channel === 'sms') throw err;
    console.warn(`Verify over WhatsApp failed for ${phone}, falling back to SMS:`, err);
    await send('sms');
    return 'sms';
  }
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
