import Twilio from 'twilio';
import { config } from '../config.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

export async function initiateAgentCall(toPhone: string, presenterPhone: string): Promise<string> {
  const voice = process.env.TWILIO_VOICE || 'Google.en-AU-Neural2-B';
  const call = await client.calls.create({
    to: toPhone,
    from: config.twilio.phoneNumber,
    twiml: `<Response>
      <Say voice="${voice}">Hello! I'm an AI assistant from Twilio. I understand you have a question about customer engagement. Let me help you with that, and if needed, I'll connect you with a specialist.</Say>
      <Pause length="3"/>
      <Say voice="${voice}">Let me transfer you to our specialist now.</Say>
      <Dial>${presenterPhone}</Dial>
    </Response>`,
  });
  return call.sid;
}
