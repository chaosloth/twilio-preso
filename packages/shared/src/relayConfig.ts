import { GOOGLE_STT_UNSUPPORTED, withLanguageDefaults } from './languages.js';
import type { LanguageVoice } from './languages.js';
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
/**
 * ElevenLabs text normalization: whether the TTS rewrites "$20.50" and "Dr." as
 * the words a person would say. `on` always, `auto` where the model thinks it
 * helps, `off` never — and `off` is both Twilio's default and the fastest, since
 * normalization happens before a single word is spoken.
 */
export const TEXT_NORMALIZATION = ['off', 'auto', 'on'] as const;
export const INTERRUPT_SENSITIVITIES = ['high', 'medium', 'low'] as const;

export type TtsProvider = (typeof TTS_PROVIDERS)[number];
export type TranscriptionProvider = (typeof TRANSCRIPTION_PROVIDERS)[number];
export type InterruptMode = (typeof INTERRUPT_MODES)[number];
export type TextNormalization = (typeof TEXT_NORMALIZATION)[number];
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
  /**
   * Every other language the call may turn into, each with the voice that speaks
   * it. Each becomes a `<Language>` child of `<ConversationRelay>` — that is what
   * makes a mid-call switch possible at all, since the switch selects an
   * already-configured language rather than introducing one.
   *
   * Per-language voices matter as much as the tags: a French sentence read by an
   * English voice is worse than not offering French. Twilio publishes a default
   * voice per language and `withLanguageDefaults` fills it in, so a presenter who
   * only types a tag still gets a native one.
   */
  languages: LanguageVoice[];
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
  /**
   * Whether ElevenLabs normalizes text before speaking it. Ignored by the other
   * providers, so it is emitted only alongside an ElevenLabs voice.
   */
  textNormalization: TextNormalization;
  /**
   * A Conversation Intelligence service sid or unique name. Set it and Twilio
   * attaches transcripts and operators to every call the agent takes — the
   * observability half of Twilio's own best practices. Empty leaves the
   * attribute off entirely: a blank one is a 64101, not a no-op.
   */
  intelligenceService: string;
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
  /**
   * Tell the agent what the *room* answered, not only what this caller did.
   *
   * Individual answers are personal and live on the caller's memory profile; the
   * aggregate is what the presentation actually built from, and a majority can
   * differ from any one attendee. On by default — the finale's whole line is
   * "here is what we built, and here is what you picked". Off is a deliberate
   * demo choice: the agent working from one person's answers alone.
   */
  roomContext: boolean;
  /**
   * How the agent should use that aggregate. Editable because what the majority
   * *means* is a property of the talk, not of this code: today the brand poll
   * decides a storefront, next month it decides something else.
   */
  outcomeInstruction: string;
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

/**
 * Appended to the system prompt on every turn *after* the opening line, and never
 * on the opening line itself.
 *
 * The app speaks its greeting before the caller has said a word, so an outbound
 * caller's first sound is almost always "hello?" — and a model whose instructions
 * are all about greeting warmly by name answers that with a second greeting. The
 * caller hears themselves welcomed twice. It lives here rather than inside the
 * editable `systemPrompt` because it is a fact about how this app opens a call,
 * not a matter of taste a presenter should be able to edit away.
 */
export const MID_CONVERSATION_RULE =
  'You have already spoken your opening line, before they said anything, so you are mid-conversation from here on: never greet them again, never say hello or repeat their name in greeting, and never re-introduce yourself. If their first words are just "hello", "hi" or "can you hear me", that is them picking up — acknowledge it in a word and go straight on with what you were asking them.';

/**
 * Appended instead of the spoken-form guidance when the same agent is reached
 * over text rather than over a phone call.
 *
 * The persona, the context block and the room's result are identical on both —
 * that is the point of one config driving two experiences — but the medium is
 * not: a reply that reads well aloud ("twenty dollars fifty", punctuation for
 * pauses) reads badly on a screen, and an SMS that runs past a couple of
 * segments is billed and rendered as several messages. It lives here rather than
 * in the editable prompt for the same reason `MID_CONVERSATION_RULE` does: it is
 * a fact about how this app delivers the reply, not a matter of taste.
 */
export const TEXT_MEDIUM_RULE =
  'You are writing a text message, not speaking, so ignore any instruction above about how words should sound: write numbers, money, dates and abbreviations normally ("$20.50", "March 28th", "Dr"), and never describe pauses or read a code out piece by piece. Keep it to one short message of at most two or three sentences — it is read on a phone screen and charged by the segment. Never mention calling, hanging up or being on the line.';

export const DEFAULT_RELAY_CONFIG: RelayConfig = {
  systemPrompt: `You are a friendly AI voice agent at a Twilio event. You were built live on stage in under five minutes — you are the demo of how fast Twilio lets a developer ship a voice AI agent.

{{context}}

Use what you know: refer to something specific they actually said or do, in their words, rather than talking in generalities. Never invent a detail that is not listed above, and if you know nothing about them, ask rather than guess.

Everything you write is spoken aloud, so write it the way it should sound: numbers, money and dates as words, not digits or symbols ("twenty dollars fifty", "March twenty-eighth"), abbreviations spelled out ("Doctor", "percent"), and an email or a code read out piece by piece. Punctuate for the pauses you want.

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
  /** The talk's own set — Mandarin, English, Italian, Bahasa Indonesia and Tamil
   *  alongside the European and Indian languages the room is likely to hold. The
   *  voices come from `LANGUAGE_VOICE_DEFAULTS`, so this is only a tag list. */
  languages: [
    { code: 'en-US' },
    { code: 'zh-CN' },
    { code: 'it-IT' },
    { code: 'id-ID' },
    { code: 'ta-IN' },
    { code: 'hi-IN' },
    { code: 'fr-FR' },
    { code: 'es-ES' },
    { code: 'ja-JP' },
  ].map(withLanguageDefaults),
  autoDetectLanguage: true,
  transcriptionProvider: 'Deepgram',
  speechModel: '',
  textNormalization: 'off',
  intelligenceService: '',
  interruptible: 'any',
  interruptSensitivity: 'high',
  ignoreBackchannel: true,
  dtmfDetection: true,
  partialPrompts: false,
  roomContext: true,
  outcomeInstruction:
    "What the room chose is what we actually built — the majority decides, not any one person. Say what was built from those answers, in the caller's own terms, and if their pick lost, acknowledge it warmly rather than glossing over it.",
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
/**
 * The agent's voice in the form the `<Say>` verb takes it.
 *
 * `<Say>` wants one `{Provider}.{Voice}` string where `<ConversationRelay>` takes
 * `ttsProvider` and `voice` separately, and it calls Amazon `Polly`. This exists
 * so the scripted finale speaks in the same voice as the live agent: they are two
 * triggers on the same moment of the talk, and two voices read as two products.
 *
 * ElevenLabs' tuning suffixes (`-flash_v2`, `-1.1_0.6_0.8`) are part of a
 * ConversationRelay voice id but not of a `<Say>` one, so they are dropped rather
 * than passed through into a voice that does not exist.
 */
export function sayVoice(config: RelayConfig): string {
  const provider = config.ttsProvider === 'Amazon' ? 'Polly' : config.ttsProvider;
  const voice =
    config.ttsProvider === 'ElevenLabs' ? config.voice.split('-')[0] : config.voice;
  return `${provider}.${voice}`;
}

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
    textNormalization: oneOf('textNormalization', TEXT_NORMALIZATION, DEFAULT_RELAY_CONFIG.textNormalization),
    // Trimmed: a sid pasted with a stray space becomes an attribute Twilio
    // cannot resolve, and the call fails rather than the observability quietly
    // not appearing.
    intelligenceService: str('intelligenceService').trim(),
    interruptible: interruptMode(source.interruptible),
    interruptSensitivity: oneOf(
      'interruptSensitivity',
      INTERRUPT_SENSITIVITIES,
      DEFAULT_RELAY_CONFIG.interruptSensitivity
    ),
    ignoreBackchannel: bool('ignoreBackchannel'),
    dtmfDetection: bool('dtmfDetection'),
    partialPrompts: bool('partialPrompts'),
    roomContext: bool('roomContext'),
    outcomeInstruction: str('outcomeInstruction'),
    maxTurnsInbound: turns('maxTurnsInbound'),
    maxTurnsOutbound: turns('maxTurnsOutbound'),
    handoffNumber: str('handoffNumber'),
    model: str('model'),
    tools: mergeTools(source.tools),
  };
}

/**
 * Only tags TwiML would accept survive; the rest are dropped rather than reaching
 * a `<Language code>` where they end the session.
 *
 * A bare string is accepted as well as a row, because a session stored before
 * per-language voices existed holds `['fr-FR', …]` — migrated here so it comes
 * back with the right voice rather than inheriting the English one. Fields are
 * copied one by one for the usual reason: a hand-edited record must not be able
 * to introduce a `<Language>` attribute.
 */
function languageList(stored: unknown): LanguageVoice[] {
  if (!Array.isArray(stored)) return DEFAULT_RELAY_CONFIG.languages.map(withLanguageDefaults);
  const rows: LanguageVoice[] = [];
  const seen = new Set<string>();
  for (const item of stored) {
    const raw: LanguageVoice | null =
      typeof item === 'string'
        ? { code: item }
        : item && typeof item === 'object' && typeof (item as LanguageVoice).code === 'string'
          ? {
              code: (item as LanguageVoice).code,
              ttsProvider: oneOf(TTS_PROVIDERS, (item as LanguageVoice).ttsProvider),
              voice: text((item as LanguageVoice).voice),
              transcriptionProvider: oneOf(
                TRANSCRIPTION_PROVIDERS,
                (item as LanguageVoice).transcriptionProvider
              ),
              speechModel: text((item as LanguageVoice).speechModel),
            }
          : null;
    if (!raw || !BCP47.test(raw.code) || seen.has(raw.code)) continue;
    seen.add(raw.code);
    rows.push(withLanguageDefaults(raw));
  }
  return rows;
}

function oneOf<T extends readonly string[]>(allowed: T, value: unknown): T[number] | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
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

/**
 * Every language the call may be conducted in, primary first.
 *
 * The primary one carries the agent's *own* voice rather than the table's default
 * for that tag: it is the voice the presenter chose and heard on the test call,
 * and a `<Language>` child that quietly replaced it would change the agent's
 * voice for no visible reason.
 */
export function resolvedLanguages(config: RelayConfig): LanguageVoice[] {
  const primary: LanguageVoice = {
    code: config.language,
    ttsProvider: config.ttsProvider,
    voice: config.voice,
    transcriptionProvider: config.transcriptionProvider,
    speechModel: config.speechModel || undefined,
  };
  const rows = [primary, ...config.languages];
  const seen = new Set<string>();
  return rows
    .filter((l) => {
      if (!BCP47.test(l.code) || seen.has(l.code)) return false;
      seen.add(l.code);
      return true;
    })
    /**
     * Every row states its transcription provider rather than inheriting one.
     * A `<Language>` that omits the attribute does *not* fall back to the
     * parent's: it falls back to the account default, which for an account that
     * used ConversationRelay before 2025-09-12 is Google. That silently pairs
     * Google STT with tags it does not publish — `google/zh-CN/`, error 64101,
     * the whole call dead before the greeting. Only the *speech model* is left
     * unstated, so Twilio still picks one that matches each language.
     */
    .map((l) => {
      const provider = l.transcriptionProvider ?? config.transcriptionProvider;
      return {
        ...l,
        // The unsupported-tag rule outranks the fill: a presenter who sets the
        // parent to Google must not thereby recreate `google/zh-CN/`. Deepgram
        // is what these tags fall to, because Deepgram does accept them.
        transcriptionProvider:
          provider === 'Google' && GOOGLE_STT_UNSUPPORTED.has(l.code) ? 'Deepgram' : provider,
      };
    });
}

/** Just the tags — what the agent's switch tool is allow-listed against. */
export function languageCodes(config: RelayConfig): string[] {
  return resolvedLanguages(config).map((l) => l.code);
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
      const others = languageCodes(config).slice(1);
      const examples = others.length ? others : [config.language];
      return `- ${relayToolToken(t.id)} with a language tag, for example ${examples
        .map((l) => `[[switch_language:${l}]]`)
        .join(' or ')} — use when ${t.whenToUse}. Only these tags are available: ${examples.join(', ')}.`;
    }
    return `- ${relayToolToken(t.id)} — use when ${t.whenToUse}.`;
  });
  return `\n\nYou have tools. To use one, include its exact token anywhere in your reply; the caller never hears the token itself:\n${lines.join('\n')}`;
}
