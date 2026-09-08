import Twilio from 'twilio';
import { enabledRelayTools, relayToolToken } from '@twilio-preso/shared';
import type { RelayConfig, RelayToolId, SessionRecord } from '@twilio-preso/shared';
import { config as env } from './config.js';

const client = Twilio(env.twilio.accountSid, env.twilio.authToken);

/**
 * Tool calls, extracted from what the model said.
 *
 * The model emits a sentinel token inline (see `relayConfig.ts` in shared for
 * why this rather than provider tool-calling). Stripping happens before the text
 * is spoken, so a token the caller was never meant to hear cannot be read out
 * even if the model puts one in a reply where it makes no sense.
 */
export interface ToolInvocation {
  /** The reply with every token removed and whitespace tidied. */
  text: string;
  called: RelayToolId[];
}

export function extractToolCalls(reply: string, config: RelayConfig): ToolInvocation {
  const called: RelayToolId[] = [];
  let text = reply;

  for (const tool of enabledRelayTools(config)) {
    const token = relayToolToken(tool.id);
    if (text.includes(token)) {
      called.push(tool.id);
      text = text.split(token).join(' ');
    }
  }

  return { text: text.replace(/\s{2,}/g, ' ').trim(), called };
}

/**
 * Sends the agent's own words as a text message, from the session's number to
 * the person on the call. Best-effort: a failed follow-up must not end a call
 * that is otherwise going fine.
 */
export async function sendFollowupSms(
  session: SessionRecord | null,
  toPhone: string | null,
  body: string
): Promise<void> {
  if (!session?.phoneNumber || !toPhone || !body.trim()) return;
  try {
    await client.messages.create({ to: toPhone, from: session.phoneNumber, body });
  } catch (err) {
    console.error('Follow-up SMS failed:', err);
  }
}
