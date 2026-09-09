import { DEFAULT_RELAY_CONFIG, USE_WHAT_YOU_KNOW } from './relayConfig.js';

/**
 * The text agent, as a session configures it.
 *
 * The same persona reached over SMS, RCS or WhatsApp instead of over a phone
 * call — and deliberately its **own** config rather than a medium flag on the
 * voice one. Half of `RelayConfig` describes a call (voice, ASR provider,
 * interruption, per-language rows, tool sentinels, a spoken greeting), and a
 * presenter editing the text agent should not have to read past any of it. What
 * they share is what actually matters: the shape of the config, the `{{context}}`
 * block, and the default wording — which is built from the voice prompt's own
 * paragraphs (`USE_WHAT_YOU_KNOW`, `outcomeInstruction`) so the two cannot drift
 * into two different personalities.
 *
 * Field names match `RelayConfig` wherever the field means the same thing, so
 * `systemPromptFor` takes either without a translation layer.
 */
export interface TextAgentConfig {
  /** The agent's instructions. `{{context}}` is replaced with what is known
   *  about the sender; without the placeholder that block is appended. */
  systemPrompt: string;
  /** Read the durable Conversation Memory profile before answering. Off leaves
   *  the agent with this session's Sync answers alone. */
  useMemory: boolean;
  /** Tell the agent what the whole room answered, not only this sender. */
  roomContext: boolean;
  /** What a majority *means* — a property of the talk, not of this code. */
  outcomeInstruction: string;
  /**
   * Replies the agent will send in one thread before it stops answering.
   *
   * A text thread has no hang-up, so this is the only thing that ends it. It is
   * counted from the thread itself rather than held in memory, so a redeploy
   * mid-event cannot hand somebody a fresh allowance.
   */
  maxTurnsInbound: number;
  /**
   * Sent when the model fails, instead of nothing.
   *
   * A silent failure on text reads as the agent ignoring the person, which is
   * worse than a stumble. Editable, and an empty string means the presenter has
   * chosen silence — so it is kept rather than defaulted back.
   */
  fallbackReply: string;
  /** Model override. Empty uses the process's LLM_MODEL. */
  model: string;
}

export const DEFAULT_TEXT_CONFIG: TextAgentConfig = {
  systemPrompt: `You are a friendly AI text agent at a Twilio event. You were built live on stage in under five minutes — you are the demo of how fast Twilio lets a developer ship a messaging AI agent.

{{context}}

${USE_WHAT_YOU_KNOW}

You are answering a text message, not a phone call, so never mention calling, hanging up or being on the line. Keep every reply SHORT — one or two sentences, because it is read on a phone screen and charged by the segment. Be warm and concrete. If they ask what you can do, say you are an agent reachable on SMS and WhatsApp through Twilio Conversation Orchestration, that reads a Twilio Conversation Memory customer profile and remembers the thread.`,
  useMemory: true,
  roomContext: true,
  outcomeInstruction: DEFAULT_RELAY_CONFIG.outcomeInstruction,
  maxTurnsInbound: 12,
  fallbackReply: "Sorry — I lost my train of thought there. Ask me again?",
  model: '',
};

/**
 * Merges a stored partial over the defaults, field by field.
 *
 * A partial is stored rather than a resolved config for the same reason
 * `resolveRelayConfig` does it: a field added later reaches an old session as its
 * new default instead of frozen at whatever shipped the day it was created. The
 * field-by-field copy is also what stops a hand-edited record introducing keys.
 */
export function resolveTextConfig(stored?: Partial<TextAgentConfig> | null): TextAgentConfig {
  const s = stored ?? {};
  const str = (value: unknown, fallback: string): string =>
    typeof value === 'string' ? value : fallback;

  return {
    systemPrompt: str(s.systemPrompt, DEFAULT_TEXT_CONFIG.systemPrompt),
    useMemory: typeof s.useMemory === 'boolean' ? s.useMemory : DEFAULT_TEXT_CONFIG.useMemory,
    roomContext:
      typeof s.roomContext === 'boolean' ? s.roomContext : DEFAULT_TEXT_CONFIG.roomContext,
    outcomeInstruction: str(s.outcomeInstruction, DEFAULT_TEXT_CONFIG.outcomeInstruction),
    // At least one: a limit of zero is an agent that is configured and silent,
    // which reads as broken rather than as switched off.
    maxTurnsInbound: Math.max(
      1,
      Math.floor(
        Number.isFinite(Number(s.maxTurnsInbound))
          ? Number(s.maxTurnsInbound)
          : DEFAULT_TEXT_CONFIG.maxTurnsInbound
      )
    ),
    fallbackReply: str(s.fallbackReply, DEFAULT_TEXT_CONFIG.fallbackReply),
    model: str(s.model, DEFAULT_TEXT_CONFIG.model),
  };
}
