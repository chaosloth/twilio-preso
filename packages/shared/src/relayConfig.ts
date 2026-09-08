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
export type RelayToolId =
  | 'end_call'
  | 'handoff_to_human'
  | 'send_followup_sms'
  | 'switch_language';

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
  /**
   * The one tool that takes an argument: the sentinel carries the language tag,
   * `[[switch_language:fr-FR]]`. On by default — a caller who answers in French
   * should be answered in French, and the alternative is an agent that hears
   * them fine and replies in the wrong language for the rest of the call.
   */
  {
    id: 'switch_language',
    enabled: true,
    whenToUse:
      'the caller speaks, or asks to continue in, one of the other supported languages — switch, then reply in that language',
  },
];

/** Languages worth one keypress in the HUD. Any BCP-47 tag can still be typed. */
export const LANGUAGE_PRESETS = [
  'en-AU',
  'en-US',
  'en-GB',
  'fr-FR',
  'es-ES',
  'de-DE',
  'it-IT',
  'pt-BR',
  'ja-JP',
  'ko-KR',
  'zh-CN',
  'hi-IN',
  'id-ID',
  'th-TH',
] as const;

/** `language`/`ttsLanguage`/`transcriptionLanguage` all accept a BCP-47 tag; a
 *  free-text box is how a typo becomes a 64101 on a ringing phone. */
const BCP47 = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/**
 * The provider and mode values `<ConversationRelay>` actually accepts. They are
 * exported because the HUD renders them as dropdowns: an invalid
 * `ttsProvider`/`voice` or `transcriptionProvider`/`speechModel` pair is not a
 * validation message, it is error 64106 and a call that ends mid-sentence — so a
 * free-text field is the wrong control for any of them.
 */
export const TTS_PROVIDERS = ['ElevenLabs', 'Google', 'Amazon'] as const;
export const TRANSCRIPTION_PROVIDERS = ['Deepgram', 'Google'] as const;

/**
 * Who may interrupt the agent, and how. TwiML takes booleans too, for backward
 * compatibility, but only as aliases: `true` = `any`, `false` = `none`.
 */
export const INTERRUPT_MODES = ['any', 'speech', 'dtmf', 'none'] as const;
export const INTERRUPT_SENSITIVITIES = ['high', 'medium', 'low'] as const;

export type TtsProvider = (typeof TTS_PROVIDERS)[number];
export type TranscriptionProvider = (typeof TRANSCRIPTION_PROVIDERS)[number];
export type InterruptMode = (typeof INTERRUPT_MODES)[number];
export type InterruptSensitivity = (typeof INTERRUPT_SENSITIVITIES)[number];

/**
 * The speech models each ASR provider offers, for the dropdown. `''` is first
 * and is the recommended value: Twilio then picks the model that fits the
 * configured language — `nova-3-general` where Deepgram supports it and
 * `nova-2-general` where it does not — which a pinned value would get wrong the
 * moment the language changes.
 */
export const SPEECH_MODELS: Record<TranscriptionProvider, readonly string[]> = {
  Deepgram: ['', 'nova-3-general', 'nova-2-general', 'flux'],
  Google: ['', 'telephony', 'long', 'short'],
};

/** Voices worth having one keypress away. Any other id can still be typed. */
export const VOICE_PRESETS: Record<TtsProvider, readonly { id: string; label: string }[]> = {
  ElevenLabs: [
    { id: 'M7ya1YbaeFaPXljg9BpK', label: 'Event voice (default)' },
    { id: 'UgBBYS2sOqTuMpoF3BR0', label: 'Twilio default' },
  ],
  Google: [
    { id: 'en-AU-Neural2-B', label: 'Australian male' },
    { id: 'en-AU-Neural2-A', label: 'Australian female' },
    { id: 'en-US-Journey-O', label: 'US Journey' },
  ],
  Amazon: [{ id: 'Joanna-Neural', label: 'Joanna' }],
};

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
  /** TTS voice: an ElevenLabs voice id, or a Google/Amazon voice name. */
  voice: string;
  ttsProvider: TtsProvider;
  /** BCP-47. Sets both the speech-to-text and the text-to-speech language. */
  language: string;
  /** Every other language the call may turn into. Each becomes a `<Language>`
   *  child of `<ConversationRelay>` — that is what makes a mid-call switch
   *  possible at all, since the switch selects an already-configured language
   *  rather than introducing one. */
  languages: string[];
  /** Let Deepgram detect the spoken language and ElevenLabs the written one,
   *  rather than pinning both to `language`. This is TwiML's `multi`, and it is
   *  only valid on that provider pair — see `supportsAutoLanguageDetection`. */
  autoDetectLanguage: boolean;
  transcriptionProvider: TranscriptionProvider;
  /** Provider-specific ASR model. Empty means the provider's default, which is
   *  what should normally be used — see `SPEECH_MODELS`. */
  speechModel: string;
  /** What stops the agent mid-sentence. Not a boolean: `dtmf` and `speech` are
   *  separately useful, and a demo may want the agent unstoppable (`none`). */
  interruptible: InterruptMode;
  /** How readily speech counts as an interruption. `low` needs a longer, more
   *  confident utterance — worth reaching for in a loud room, where `high` turns
   *  the audience's own noise into a barge-in. */
  interruptSensitivity: InterruptSensitivity;
  /** Drop "yeah", "uh-huh", "okay" rather than treating them as interruptions.
   *  On by default: on a stage the agent is talking over applause and agreement. */
  ignoreBackchannel: boolean;
  dtmfDetection: boolean;
  /** Ask Twilio for unfinalized prompts (`last: false`) as the caller is still
   *  talking, so the agent can start on the turn a beat earlier. Off by default:
   *  it multiplies the `prompt` events an app has to reason about, and a demo
   *  that double-answers is worse than one that waits. */
  partialPrompts: boolean;
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
  voice: 'M7ya1YbaeFaPXljg9BpK',
  ttsProvider: 'ElevenLabs',
  language: 'en-AU',
  languages: ['en-US', 'fr-FR', 'es-ES', 'ja-JP', 'hi-IN', 'zh-CN'],
  autoDetectLanguage: true,
  transcriptionProvider: 'Deepgram',
  speechModel: '',
  interruptible: 'any',
  interruptSensitivity: 'high',
  ignoreBackchannel: true,
  dtmfDetection: true,
  partialPrompts: false,
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
  /**
   * A stored value is only accepted when it is one of the values TwiML allows.
   * Anything else falls back to the default rather than reaching the TwiML,
   * where an unrecognised provider or mode is a 64101/64106 that ends the call.
   */
  const oneOf = <T extends string>(key: keyof RelayConfig, allowed: readonly T[], fallback: T): T =>
    allowed.includes(source[key] as T) ? (source[key] as T) : fallback;

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
    ttsProvider: oneOf('ttsProvider', TTS_PROVIDERS, DEFAULT_RELAY_CONFIG.ttsProvider),
    language: str('language'),
    languages: languageList(source.languages),
    autoDetectLanguage: bool('autoDetectLanguage'),
    transcriptionProvider: oneOf(
      'transcriptionProvider',
      TRANSCRIPTION_PROVIDERS,
      DEFAULT_RELAY_CONFIG.transcriptionProvider
    ),
    speechModel: str('speechModel'),
    interruptible: interruptMode(source.interruptible),
    interruptSensitivity: oneOf(
      'interruptSensitivity',
      INTERRUPT_SENSITIVITIES,
      DEFAULT_RELAY_CONFIG.interruptSensitivity
    ),
    ignoreBackchannel: bool('ignoreBackchannel'),
    dtmfDetection: bool('dtmfDetection'),
    partialPrompts: bool('partialPrompts'),
    maxTurnsInbound: turns('maxTurnsInbound'),
    maxTurnsOutbound: turns('maxTurnsOutbound'),
    handoffNumber: str('handoffNumber'),
    model: str('model'),
    tools: mergeTools(source.tools),
  };
}

/** Only tags TwiML would accept survive; the rest are dropped rather than
 *  reaching a `<Language code>` where they end the session. */
function languageList(stored: unknown): string[] {
  if (!Array.isArray(stored)) return [...DEFAULT_RELAY_CONFIG.languages];
  return [...new Set(stored.filter((l): l is string => typeof l === 'string' && BCP47.test(l)))];
}

/**
 * Whether `multi` may be sent at all.
 *
 * Twilio's automatic detection is Deepgram for speech-to-text and ElevenLabs for
 * text-to-speech; on any other pair the session errors and the call ends. So the
 * capability is derived from the providers and the stored flag can only turn a
 * supported setup off, never turn an unsupported one on.
 */
export function supportsAutoLanguageDetection(config: RelayConfig): boolean {
  return config.transcriptionProvider === 'Deepgram' && config.ttsProvider === 'ElevenLabs';
}

/** Every language the call may be conducted in, primary first. */
export function resolvedLanguages(config: RelayConfig): string[] {
  return [...new Set([config.language, ...config.languages])].filter((l) => BCP47.test(l));
}

/**
 * `interruptible` was a boolean before it was a mode, so a session stored one.
 * TwiML's own aliases are used to read it — `true` = `any`, `false` = `none` —
 * so an existing session keeps the behaviour the presenter chose rather than
 * quietly reverting to the default.
 */
function interruptMode(stored: unknown): InterruptMode {
  if (typeof stored === 'boolean') return stored ? 'any' : 'none';
  return INTERRUPT_MODES.includes(stored as InterruptMode)
    ? (stored as InterruptMode)
    : DEFAULT_RELAY_CONFIG.interruptible;
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
  const lines = tools.map((t) => {
    // The switch tool is the only one with an argument, and the argument is a
    // closed set: naming the tags inline is what stops the model inventing one
    // the TwiML never declared.
    if (t.id === 'switch_language') {
      const others = resolvedLanguages(config).slice(1);
      const examples = others.length ? others : [config.language];
      return `- ${relayToolToken(t.id)} with a language tag, for example ${examples
        .map((l) => `[[switch_language:${l}]]`)
        .join(' or ')} — use when ${t.whenToUse}. Only these tags are available: ${examples.join(', ')}.`;
    }
    return `- ${relayToolToken(t.id)} — use when ${t.whenToUse}.`;
  });
  return `\n\nYou have tools. To use one, include its exact token anywhere in your reply; the caller never hears the token itself:\n${lines.join('\n')}`;
}
