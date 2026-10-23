/**
 * The scripted mass call's `<Say>` — what `voice-mass-outbound` rings the room
 * into — per presentation, edited in the HUD's voice tab.
 *
 * Its own partial on the session rather than a corner of the relay config: the
 * scripted call and the live agent are separate triggers, and the point of
 * configuring this one is that changing its voice does not change the agent's.
 * Stored as a partial and merged field by field by `resolveSayConfig`, like
 * every other per-session config here, so a field added later arrives as its
 * default and a hand-edited record cannot introduce attributes.
 */

/** `<Say>`'s voice providers, as its `voice` attribute prefixes them. Amazon is
 *  `Polly` here, where `<ConversationRelay>` calls it `Amazon`. */
export const SAY_PROVIDERS = ['ElevenLabs', 'Polly', 'Google'] as const;
export type SayProvider = (typeof SAY_PROVIDERS)[number];

/** Upper bound on `loop`. TwiML's own `0` means "until hang-up or 1,000 times",
 *  which a finale ringing a whole room must never do, so it is not offered. */
export const SAY_MAX_LOOP = 5;
export const SAY_MAX_PAUSE_SECONDS = 10;
/** Long enough for the shipped script several times over; short enough that a
 *  pasted document does not become a ten-minute call to every phone. */
export const SAY_MAX_MESSAGE = 2000;

export interface SayConfig {
  provider: SayProvider;
  /** An ElevenLabs voice id, or a Polly / Google voice name. */
  voice: string;
  /** BCP-47. Empty leaves the attribute off, and the voice's own language wins. */
  language: string;
  /** How many times the message is spoken, 1–`SAY_MAX_LOOP`. */
  loop: number;
  /** Silence after the message, before the call hangs up. */
  pauseSeconds: number;
  /** What every phone hears. Plain text — it is escaped into the TwiML. */
  message: string;
}

export const DEFAULT_SAY_CONFIG: SayConfig = {
  provider: 'ElevenLabs',
  voice: 'sai9UY7iXkRDSsXHR0bZ',
  language: '',
  loop: 1,
  pauseSeconds: 1,
  message:
    'Hey there! Every phone in this room just rang at the same time — and what you watched today was a startup being created live, on stage, in front of you. That is the power of Twilio. Whether you are reaching one customer or a thousand, Twilio scales with you. If you like, call me back and we can talk about your individual experiences. Thanks for being part of it today.',
};

/** Voices worth one click. Any other id can still be typed. */
export const SAY_VOICE_PRESETS: Record<SayProvider, readonly { id: string; label: string }[]> = {
  ElevenLabs: [
    { id: 'sai9UY7iXkRDSsXHR0bZ', label: 'Mass call (default)' },
    { id: 'M7ya1YbaeFaPXljg9BpK', label: 'Event agent voice' },
  ],
  Polly: [{ id: 'Joanna-Neural', label: 'Joanna' }, { id: 'Olivia-Neural', label: 'Olivia (AU)' }],
  Google: [{ id: 'en-AU-Neural2-B', label: 'Australian male' }, { id: 'en-AU-Neural2-A', label: 'Australian female' }],
};

const BCP47 = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
/** A voice id or name: what each provider's ids are made of, and nothing that
 *  could close the attribute it is written into. */
const VOICE_ID = /^[A-Za-z0-9._-]+$/;

export function resolveSayConfig(stored?: Partial<SayConfig> | null): SayConfig {
  const source = stored ?? {};
  const d = DEFAULT_SAY_CONFIG;
  const int = (value: unknown, min: number, max: number, fallback: number): number => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  };
  const provider = SAY_PROVIDERS.includes(source.provider as SayProvider)
    ? (source.provider as SayProvider)
    : d.provider;
  const voice = typeof source.voice === 'string' ? source.voice.trim() : '';
  const language = typeof source.language === 'string' ? source.language.trim() : '';
  const message = typeof source.message === 'string' ? source.message.trim() : '';
  return {
    provider,
    // A voice belongs to its provider: a stored voice that cannot be one falls
    // back to that provider's first preset, never to another provider's id.
    voice: VOICE_ID.test(voice) ? voice : provider === d.provider ? d.voice : SAY_VOICE_PRESETS[provider][0].id,
    language: BCP47.test(language) ? language : '',
    loop: int(source.loop, 1, SAY_MAX_LOOP, d.loop),
    pauseSeconds: int(source.pauseSeconds, 0, SAY_MAX_PAUSE_SECONDS, d.pauseSeconds),
    // An empty message is a call that rings and says nothing.
    message: message ? message.slice(0, SAY_MAX_MESSAGE) : d.message,
  };
}

/**
 * The `voice` attribute `<Say>` takes: `{Provider}.{voice}`. ElevenLabs'
 * ConversationRelay tuning suffixes (`-flash_v2`, `-1.1_0.6_0.8`) are dropped —
 * they are part of a relay voice id, not a `<Say>` one.
 */
export function sayVoiceAttribute(config: SayConfig): string {
  const voice = config.provider === 'ElevenLabs' ? config.voice.split('-')[0] : config.voice;
  return `${config.provider}.${voice}`;
}
