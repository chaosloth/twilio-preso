/**
 * How the voice agent behaves, per presentation.
 *
 * Everything here used to be hardcoded in two places — the system prompt and
 * turn limits inside the relay process, the TTS voice and TwiML attributes
 * inside the backend — which meant tailoring the agent to an audience required a
 * code change and a redeploy of two packages. It is a `SessionRecord` field
 * instead, edited in the HUD, so the same running deployment can hold a French
 * ElevenLabs agent for one event and an Australian Google one for the next.
 *
 * The record stores a **partial**: only what the presenter actually changed.
 * `resolveRelayConfig` merges it over the defaults field by field, so a session
 * created before a field existed still gets that field's default, and a foreign
 * or hand-edited config cannot introduce keys the app does not declare.
 */

/**
 * The agent's tools.
 *
 * These are not provider tool-calls: the relay speaks to two LLM providers
 * through one small `complete()` interface, and a phone call cannot afford the
 * extra round trip a tool-use turn costs anyway. The model is told to emit a
 * sentinel — `[[end_call]]` — and the relay strips it and performs the action.
 * That works identically on every provider, and a model that ignores the
 * convention just produces a normal reply rather than a broken turn.
 */
export type RelayToolId = 'end_call' | 'handoff_to_human' | 'send_followup_sms';

export interface RelayTool {
  id: RelayToolId;
  enabled: boolean;
  /** When the model should reach for it. Editable: this is prompt text. */
  whenToUse: string;
}

/** The tools that exist, with their shipped defaults. */
export const RELAY_TOOLS: RelayTool[] = [
  {
    id: 'end_call',
    enabled: true,
    whenToUse: 'the caller says goodbye or clearly has nothing more to ask — say your farewell in the same reply',
  },
  {
    id: 'handoff_to_human',
    enabled: false,
    whenToUse: 'the caller asks to speak to a person; tell them you are transferring them',
  },
  {
    id: 'send_followup_sms',
    enabled: false,
    whenToUse: 'the caller asks for something in writing — a link, a summary, a next step',
  },
];

export interface RelayConfig {
  /** The agent's instructions. `{{context}}` is replaced with what is known
   *  about the caller; without the placeholder that block is appended. */
  systemPrompt: string;
  /** Ask the model to write the opening line rather than reading `staticGreeting`.
   *  The static one is still the fallback — a dead model on the first turn is
   *  silence on a ringing phone. */
  generateGreeting: boolean;
  /** What the model is told to do on the opening turn. */
  greetingInstruction: string;
  /** The always-available opening line. `{{name}}` becomes the caller's name. */
  staticGreeting: string;
  /** Read the durable Conversation Memory profile at setup. Off makes the agent
   *  see only this session's answers — worth being able to show. */
  useMemory: boolean;
  /** TTS voice, e.g. `Google.en-AU-Neural2-B` or an ElevenLabs voice id. */
  voice: string;
  ttsProvider: string;
  /** BCP-47. Sets both the speech-to-text and the text-to-speech language. */
  language: string;
  transcriptionProvider: string;
  /** Provider-specific ASR model. Empty means the provider's default. */
  speechModel: string;
  interruptible: boolean;
  dtmfDetection: boolean;
  /** Turns before the agent says goodbye. Inbound is longer on purpose: someone
   *  who chose to ring in is having a conversation, not watching a beat of a
   *  presentation. */
  maxTurnsInbound: number;
  maxTurnsOutbound: number;
  /** Where `handoff_to_human` dials. Empty falls back to the session owner. */
  handoffNumber: string;
  /** Voice-agent model override. Empty uses the process's VOICE_LLM_MODEL/LLM_MODEL. */
  model: string;
  tools: RelayTool[];
}

export const DEFAULT_RELAY_CONFIG: RelayConfig = {
  systemPrompt: `You are a friendly AI voice agent at a Twilio event. You were built live on stage in under five minutes — you are the demo of how fast Twilio lets a developer ship a voice AI agent.

{{context}}

Use what you know: refer to something specific they actually said or do, in their words, rather than talking in generalities. Never invent a detail that is not listed above, and if you know nothing about them, ask rather than guess.

Keep every reply SHORT — one or two sentences, because this is a phone call and they are standing in a room. Be warm and concrete. If they ask what you can do, say you are a ConversationRelay agent that handles real-time voice, reads a Twilio Conversation Memory customer profile, and can hand off to a human.`,
  generateGreeting: true,
  greetingInstruction:
    'Greet them by name in one or two sentences, refer to one specific thing you know about them, and ask them one question about it.',
  staticGreeting:
    "Hi {{name}}! I'm the AI agent that was just built live on stage. What would you like to ask me?",
  useMemory: true,
  voice: 'en-AU-Neural2-B',
  ttsProvider: 'Google',
  language: 'en-AU',
  transcriptionProvider: 'Google',
  speechModel: '',
  interruptible: true,
  dtmfDetection: true,
  maxTurnsInbound: 12,
  maxTurnsOutbound: 3,
  handoffNumber: '',
  model: '',
  tools: RELAY_TOOLS,
};

/**
 * Merges a stored partial over the defaults.
 *
 * Copied key by key rather than spread: the stored value came from a Sync
 * document that a hand-edited export or an older build could have written, and
 * only declared fields may reach the prompt or the TwiML.
 */
export function resolveRelayConfig(stored?: Partial<RelayConfig> | null): RelayConfig {
  const source = stored ?? {};
  const pick = <K extends keyof RelayConfig>(key: K): RelayConfig[K] =>
    source[key] === undefined || source[key] === null
      ? DEFAULT_RELAY_CONFIG[key]
      : (source[key] as RelayConfig[K]);

  const str = <K extends keyof RelayConfig>(key: K): string =>
    typeof source[key] === 'string' ? (source[key] as string) : (DEFAULT_RELAY_CONFIG[key] as string);
  const bool = <K extends keyof RelayConfig>(key: K): boolean =>
    typeof source[key] === 'boolean' ? (source[key] as boolean) : (DEFAULT_RELAY_CONFIG[key] as boolean);
  // A zero-turn agent greets and hangs up, which reads as a broken demo rather
  // than a configured one.
  const turns = (key: 'maxTurnsInbound' | 'maxTurnsOutbound'): number => {
    const value = Number(pick(key));
    return Number.isFinite(value) ? Math.max(1, Math.round(value)) : DEFAULT_RELAY_CONFIG[key];
  };

  return {
    systemPrompt: str('systemPrompt'),
    generateGreeting: bool('generateGreeting'),
    greetingInstruction: str('greetingInstruction'),
    staticGreeting: str('staticGreeting'),
    useMemory: bool('useMemory'),
    voice: str('voice'),
    ttsProvider: str('ttsProvider'),
    language: str('language'),
    transcriptionProvider: str('transcriptionProvider'),
    speechModel: str('speechModel'),
    interruptible: bool('interruptible'),
    dtmfDetection: bool('dtmfDetection'),
    maxTurnsInbound: turns('maxTurnsInbound'),
    maxTurnsOutbound: turns('maxTurnsOutbound'),
    handoffNumber: str('handoffNumber'),
    model: str('model'),
    tools: mergeTools(source.tools),
  };
}

/**
 * Tools are merged by id against `RELAY_TOOLS`, never taken wholesale: a stored
 * list is how a tool the code no longer implements — or one it never did — would
 * otherwise end up described to the model as though it worked.
 */
function mergeTools(stored?: RelayTool[] | null): RelayTool[] {
  const overrides = new Map((stored ?? []).map((t) => [t.id, t]));
  return RELAY_TOOLS.map((tool) => {
    const override = overrides.get(tool.id);
    return {
      id: tool.id,
      enabled: typeof override?.enabled === 'boolean' ? override.enabled : tool.enabled,
      whenToUse: typeof override?.whenToUse === 'string' && override.whenToUse.trim()
        ? override.whenToUse
        : tool.whenToUse,
    };
  });
}

export function enabledRelayTools(config: RelayConfig): RelayTool[] {
  return config.tools.filter((t) => t.enabled);
}

/** The sentinel the model emits to call a tool. */
export function relayToolToken(id: RelayToolId): string {
  return `[[${id}]]`;
}

/** The tool section of the system prompt. Empty when nothing is enabled, so a
 *  bare agent is never told about a convention it has no use for. */
export function relayToolPrompt(config: RelayConfig): string {
  const tools = enabledRelayTools(config);
  if (tools.length === 0) return '';
  const lines = tools.map((t) => `- ${relayToolToken(t.id)} — use when ${t.whenToUse}.`);
  return `\n\nYou have tools. To use one, include its exact token anywhere in your reply; the caller never hears the token itself:\n${lines.join('\n')}`;
}
