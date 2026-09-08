import type { RelayConfig } from './relayConfig.js';

/**
 * A language the agent can speak, and who speaks it.
 *
 * One of these becomes one `<Language>` child of `<ConversationRelay>`, whose
 * attributes override the parent for that language alone — which is the only way
 * a multi-language call sounds right: a French sentence read by an English voice
 * is worse than not offering French at all. An omitted field inherits the
 * parent, so a row may carry nothing but a code.
 */
export interface LanguageVoice {
  /** BCP-47, e.g. `fr-FR`. Matched case-insensitively when the agent switches. */
  code: string;
  ttsProvider?: RelayConfig['ttsProvider'];
  voice?: string;
  transcriptionProvider?: RelayConfig['transcriptionProvider'];
  /** Empty inherits the parent, which is normally the provider's own default —
   *  a pinned model becomes an invalid pair the moment the language changes. */
  speechModel?: string;
}

/**
 * Twilio's own default voice per language for ConversationRelay, from
 * `docs/voice/conversationrelay/voice-configuration`. Every one of these is an
 * ElevenLabs voice id chosen by Twilio for that language, so a presenter adding
 * a language gets a native-sounding voice without picking one — and any of them
 * can still be overridden per language in the HUD.
 *
 * The labels are here so the HUD can name a language rather than only its tag.
 */
export const LANGUAGE_VOICE_DEFAULTS: Record<
  string,
  { label: string } & Required<Pick<LanguageVoice, 'ttsProvider' | 'voice'>> &
    Pick<LanguageVoice, 'transcriptionProvider'>
> = {
  'bg-BG': { label: 'Bulgarian', ttsProvider: 'ElevenLabs', voice: 'AB9XsbSA4eLG12t2myjN' },
  'cs-CZ': { label: 'Czech', ttsProvider: 'ElevenLabs', voice: 'uYFJyGaibp4N2VwYQshk' },
  'da-DK': { label: 'Danish', ttsProvider: 'ElevenLabs', voice: 'ygiXC2Oa1BiHksD3WkJZ' },
  'de-DE': { label: 'German', ttsProvider: 'ElevenLabs', voice: 'FTNCalFNG5bRnkkaP5Ug' },
  'en-AU': { label: 'English (Australia)', ttsProvider: 'ElevenLabs', voice: '9Ft9sm9dzvprPILZmLJl' },
  'en-GB': { label: 'English (UK)', ttsProvider: 'ElevenLabs', voice: 'Fahco4VZzobUeiPqni1S' },
  'en-IN': { label: 'English (India)', ttsProvider: 'ElevenLabs', voice: 'mCQMfsqGDT6IDkEKR20a' },
  'en-US': { label: 'English (US)', ttsProvider: 'ElevenLabs', voice: 'UgBBYS2sOqTuMpoF3BR0' },
  'es-ES': { label: 'Spanish', ttsProvider: 'ElevenLabs', voice: '6xftrpatV0jGmFHxDjUv' },
  'es-US': { label: 'Spanish (US)', ttsProvider: 'ElevenLabs', voice: 'CaJslL1xziwefCeTNzHv' },
  'fi-FI': { label: 'Finnish', ttsProvider: 'ElevenLabs', voice: '6xPz2opT0y5qtoRh1U1Y' },
  'fr-CA': { label: 'French (Canada)', ttsProvider: 'ElevenLabs', voice: 'IPgYtHTNLjC7Bq7IPHrm' },
  'fr-FR': { label: 'French', ttsProvider: 'ElevenLabs', voice: 'a5n9pJUnAhX4fn7lx3uo' },
  'hi-IN': { label: 'Hindi', ttsProvider: 'ElevenLabs', voice: 'IvLWq57RKibBrqZGpQrC' },
  'hu-HU': { label: 'Hungarian', ttsProvider: 'ElevenLabs', voice: 'TumdjBNWanlT3ysvclWh' },
  'id-ID': { label: 'Bahasa Indonesia', ttsProvider: 'ElevenLabs', voice: '1k39YpzqXZn52BgyLyGO' },
  'it-IT': { label: 'Italian', ttsProvider: 'ElevenLabs', voice: 'uScy1bXtKz8vPzfdFsFw' },
  'ja-JP': { label: 'Japanese', ttsProvider: 'ElevenLabs', voice: '3JDquces8E8bkmvbh6Bc' },
  'ko-KR': { label: 'Korean', ttsProvider: 'ElevenLabs', voice: 'uyVNoMrnUku1dZyVEXwD' },
  'nl-BE': { label: 'Dutch (Belgium)', ttsProvider: 'ElevenLabs', voice: 's7Z6uboUuE4Nd8Q2nye6' },
  'nl-NL': { label: 'Dutch', ttsProvider: 'ElevenLabs', voice: 'UNBIyLbtFB9k7FKW8wJv' },
  'pl-PL': { label: 'Polish', ttsProvider: 'ElevenLabs', voice: 'W0sqKm1Sfw1EzlCH14FQ' },
  'pt-BR': { label: 'Portuguese (Brazil)', ttsProvider: 'ElevenLabs', voice: 'CstacWqMhJQlnfLPxRG4' },
  'pt-PT': { label: 'Portuguese', ttsProvider: 'ElevenLabs', voice: 'TsZfI8Nbn2Xd7ArC76n9' },
  'ro-RO': { label: 'Romanian', ttsProvider: 'ElevenLabs', voice: 'OlBp4oyr3FBAGEAtJOnU' },
  'ru-RU': { label: 'Russian', ttsProvider: 'ElevenLabs', voice: 'AB9XsbSA4eLG12t2myjN' },
  'sv-SE': { label: 'Swedish', ttsProvider: 'ElevenLabs', voice: '4xkUqaR9MYOJHoaC1Nak' },
  'ta-IN': { label: 'Tamil', ttsProvider: 'ElevenLabs', voice: 'ZhJ5LanYnCmLKQUXvsV7' },
  'tr-TR': { label: 'Turkish', ttsProvider: 'ElevenLabs', voice: 'IuRRIAcbQK5AQk1XevPj' },
  'uk-UA': { label: 'Ukrainian', ttsProvider: 'ElevenLabs', voice: 'nCqaTnIbLdME87OuQaZY' },
  'vi-VN': { label: 'Vietnamese', ttsProvider: 'ElevenLabs', voice: 'foH7s9fX31wFFH2yqrFa' },
  /**
   * Mandarin is the one language Twilio's ElevenLabs table does not cover, and a
   * talk in Singapore needs it — so the *voice* comes from Google instead. Google
   * names the language `cmn-CN` for TTS and `cmn-Hans-CN` for STT, neither of
   * which is the `zh-CN` tag Twilio wants in `code` — which is why the voice id
   * does not begin with the tag, and why transcription is left inherited
   * (`GOOGLE_STT_UNSUPPORTED` below).
   *
   * Consequences worth knowing: this language cannot take part in `multi`
   * automatic detection (that needs ElevenLabs throughout), and it is the one row
   * here not copied from a Twilio table — check it in the Console against the
   * account's available voices before a talk depends on it.
   */
  'zh-CN': { label: 'Mandarin', ttsProvider: 'Google', voice: 'cmn-CN-Wavenet-A' },
};

/**
 * Tags Google speech-to-text does not publish, so `transcriptionProvider="Google"`
 * on one of these is invalid TwiML — Twilio rejects the pair it builds from the
 * row (`google/zh-CN/`, error 64101) and the whole call fails before a word is
 * spoken. It is the *tag* that is wrong, not the language: Google STT v2 calls
 * Mandarin `cmn-Hans-CN`, while `code` here has to be the BCP-47 tag TTS and the
 * agent's switch tool use. Deepgram accepts `zh-CN`, so these inherit it.
 */
const GOOGLE_STT_UNSUPPORTED = new Set(['zh-CN']);

/** Tags the HUD offers, most-likely first. Any other BCP-47 tag may be typed. */
export const LANGUAGE_PRESETS = Object.keys(LANGUAGE_VOICE_DEFAULTS);

/** The label for a tag, or the tag itself when it is not one of Twilio's. */
export function languageLabel(code: string): string {
  return LANGUAGE_VOICE_DEFAULTS[code]?.label ?? code;
}

/**
 * A language row with Twilio's defaults filled in where the presenter has not
 * chosen. Filled here rather than at TwiML time so the HUD shows the voice that
 * will actually speak, instead of a blank that means "something else decides".
 */
export function withLanguageDefaults(entry: LanguageVoice): LanguageVoice {
  const preset = LANGUAGE_VOICE_DEFAULTS[entry.code];
  if (!preset) return { ...entry };
  const transcriptionProvider = entry.transcriptionProvider ?? preset.transcriptionProvider;
  return {
    ...entry,
    ttsProvider: entry.ttsProvider ?? preset.ttsProvider,
    voice: entry.voice ?? preset.voice,
    // Dropped rather than kept, and dropped on read rather than on write: a
    // session created while Mandarin defaulted to Google ASR holds that in its
    // record, where it stays a call-ending 64101 until something removes it.
    transcriptionProvider:
      transcriptionProvider === 'Google' && GOOGLE_STT_UNSUPPORTED.has(entry.code)
        ? undefined
        : transcriptionProvider,
  };
}
