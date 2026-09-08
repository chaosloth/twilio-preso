import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RELAY_CONFIG,
  RELAY_TOOLS,
  relayToolPrompt,
  resolveRelayConfig,
  INTERRUPT_MODES,
  supportsAutoLanguageDetection,
  languageCodes,
  resolvedLanguages,
} from '../relayConfig.js';

describe('resolveRelayConfig', () => {
  it('returns the defaults when the session has no overrides', () => {
    expect(resolveRelayConfig(undefined)).toEqual(DEFAULT_RELAY_CONFIG);
  });

  it('keeps every default the override does not mention', () => {
    const resolved = resolveRelayConfig({ voice: 'Google.en-GB-Neural2-A' });
    expect(resolved.voice).toBe('Google.en-GB-Neural2-A');
    expect(resolved.language).toBe(DEFAULT_RELAY_CONFIG.language);
    expect(resolved.systemPrompt).toBe(DEFAULT_RELAY_CONFIG.systemPrompt);
  });

  it('ignores keys the config does not declare, so a foreign file cannot inject any', () => {
    const resolved = resolveRelayConfig({ hacked: true, voice: 'x' } as never);
    expect('hacked' in resolved).toBe(false);
  });

  it('merges tools by id and keeps unknown tool ids out', () => {
    const resolved = resolveRelayConfig({
      tools: [{ id: 'end_call', enabled: false }, { id: 'nope', enabled: true }] as never,
    });
    expect(resolved.tools.map((t) => t.id)).toEqual(RELAY_TOOLS.map((t) => t.id));
    expect(resolved.tools.find((t) => t.id === 'end_call')!.enabled).toBe(false);
  });

  it('clamps turn limits to at least one exchange', () => {
    expect(resolveRelayConfig({ maxTurnsInbound: 0 }).maxTurnsInbound).toBe(1);
  });
});

describe('relayToolPrompt', () => {
  it('is empty when no tool is enabled', () => {
    const config = resolveRelayConfig({ tools: RELAY_TOOLS.map((t) => ({ ...t, enabled: false })) });
    expect(relayToolPrompt(config)).toBe('');
  });

  it('names each enabled tool with its own sentinel and instructions', () => {
    const config = resolveRelayConfig({
      tools: RELAY_TOOLS.map((t) => ({ ...t, enabled: t.id === 'end_call' })),
    });
    const prompt = relayToolPrompt(config);
    expect(prompt).toContain('[[end_call]]');
    expect(prompt).not.toContain('[[handoff_to_human]]');
  });
});

describe('provider defaults', () => {
  it('ships ElevenLabs TTS with the event voice and Deepgram ASR', () => {
    expect(DEFAULT_RELAY_CONFIG.ttsProvider).toBe('ElevenLabs');
    expect(DEFAULT_RELAY_CONFIG.voice).toBe('M7ya1YbaeFaPXljg9BpK');
    expect(DEFAULT_RELAY_CONFIG.transcriptionProvider).toBe('Deepgram');
  });

  /**
   * Twilio picks the right Deepgram model for the configured language
   * (nova-3-general where it exists, nova-2-general elsewhere). Pinning one here
   * would be us guessing on Twilio's behalf and is how a language change turns
   * into an invalid provider/model pair that ends the session.
   */
  it('leaves the speech model to the provider', () => {
    expect(DEFAULT_RELAY_CONFIG.speechModel).toBe('');
  });
});

describe('interruption settings', () => {
  it('lets the caller interrupt by speech or keypad out of the box', () => {
    expect(DEFAULT_RELAY_CONFIG.interruptible).toBe('any');
    expect(DEFAULT_RELAY_CONFIG.interruptSensitivity).toBe('high');
    expect(DEFAULT_RELAY_CONFIG.ignoreBackchannel).toBe(true);
  });

  it('accepts every mode TwiML accepts', () => {
    for (const mode of INTERRUPT_MODES) {
      expect(resolveRelayConfig({ interruptible: mode }).interruptible).toBe(mode);
    }
  });

  it('rejects a mode TwiML would refuse, rather than passing it into the TwiML', () => {
    expect(resolveRelayConfig({ interruptible: 'sometimes' as never }).interruptible).toBe('any');
  });

  /**
   * Sessions created before this was an enum hold a boolean. TwiML itself maps
   * them this way for backward compatibility, so the stored value keeps meaning
   * what the presenter chose instead of silently reverting to the default.
   */
  it('migrates the boolean a pre-enum session stored', () => {
    expect(resolveRelayConfig({ interruptible: true as never }).interruptible).toBe('any');
    expect(resolveRelayConfig({ interruptible: false as never }).interruptible).toBe('none');
  });

  it('clamps sensitivity to the three values TwiML allows', () => {
    expect(resolveRelayConfig({ interruptSensitivity: 'low' }).interruptSensitivity).toBe('low');
    expect(resolveRelayConfig({ interruptSensitivity: 'loud' as never }).interruptSensitivity).toBe(
      DEFAULT_RELAY_CONFIG.interruptSensitivity
    );
  });
});

describe('language switching', () => {
  it('offers the caller a language switch out of the box', () => {
    const config = resolveRelayConfig();
    expect(config.tools.find((t) => t.id === 'switch_language')?.enabled).toBe(true);
  });

  /**
   * Automatic detection is only available on the Deepgram/ElevenLabs pair.
   * Sending `multi` with any other provider is not a validation message — the
   * session errors and the call ends — so the capability is derived from the
   * providers rather than trusted from the stored flag.
   */
  it('only supports auto-detection on Deepgram ASR with ElevenLabs TTS', () => {
    expect(supportsAutoLanguageDetection(resolveRelayConfig())).toBe(true);
    expect(
      supportsAutoLanguageDetection(resolveRelayConfig({ transcriptionProvider: 'Google' }))
    ).toBe(false);
    expect(supportsAutoLanguageDetection(resolveRelayConfig({ ttsProvider: 'Google' }))).toBe(false);
  });

  it('resolves the primary language first and never repeats it', () => {
    const config = resolveRelayConfig({ language: 'fr-FR', languages: ['fr-FR', 'ja-JP'] as never });
    expect(languageCodes(config)).toEqual(['fr-FR', 'ja-JP']);
  });

  it('drops a language that is not a plausible BCP-47 tag', () => {
    const config = resolveRelayConfig({ languages: ['ja-JP', 'nonsense language', ''] as never });
    expect(languageCodes(config)).toEqual([DEFAULT_RELAY_CONFIG.language, 'ja-JP']);
  });

  it('tells the model which languages it may switch to', () => {
    const config = resolveRelayConfig({ language: 'en-AU', languages: ['ja-JP'] as never });
    const prompt = relayToolPrompt(config);
    expect(prompt).toContain('[[switch_language:ja-JP]]');
    expect(prompt).toContain('ja-JP');
  });

  it('says nothing about switching when the tool is off', () => {
    const config = resolveRelayConfig({
      tools: RELAY_TOOLS.map((t) => ({ ...t, enabled: t.id !== 'switch_language' })),
    });
    expect(relayToolPrompt(config)).not.toContain('switch_language');
  });
});

describe('partial prompts', () => {
  /**
   * Unfinalized prompts arrive as extra `prompt` events with `last: false`. They
   * shorten the gap before the agent can start thinking, but they also mean the
   * app sees each turn several times — so this ships off, and turning it on is a
   * deliberate choice made per session.
   */
  it('ships off, and is a boolean', () => {
    expect(DEFAULT_RELAY_CONFIG.partialPrompts).toBe(false);
    expect(resolveRelayConfig({ partialPrompts: true }).partialPrompts).toBe(true);
    expect(resolveRelayConfig({ partialPrompts: 'yes' as never }).partialPrompts).toBe(false);
  });
});

describe('per-language voices', () => {
  /**
   * The languages the talk actually needs. Mandarin is the interesting one: it is
   * the only default that is not an ElevenLabs voice, because Twilio's ElevenLabs
   * table has no Mandarin entry.
   */
  it('ships the languages the talk needs, each with a voice', () => {
    const codes = languageCodes(resolveRelayConfig());
    for (const wanted of ['en-AU', 'en-US', 'zh-CN', 'it-IT', 'id-ID', 'ta-IN', 'hi-IN']) {
      expect(codes).toContain(wanted);
    }
    for (const entry of resolvedLanguages(resolveRelayConfig())) {
      expect(entry.voice).toBeTruthy();
      expect(entry.ttsProvider).toBeTruthy();
    }
  });

  /**
   * Mandarin needs a Google *voice* and must not ask for Google *transcription*.
   * TTS and ASR are separate choices, and Google STT v2 publishes Mandarin as
   * `cmn-Hans-CN` — there is no `zh-CN` there. Sending the pair Twilio built from
   * this row (`google/zh-CN/`) is a 64101 that fails the whole call, so the row
   * inherits Deepgram, which does accept `zh-CN`.
   */
  it('gives Mandarin a Google voice but leaves transcription inherited', () => {
    const mandarin = resolvedLanguages(resolveRelayConfig()).find((l) => l.code === 'zh-CN');
    expect(mandarin?.ttsProvider).toBe('Google');
    expect(mandarin?.voice).toBe('cmn-CN-Wavenet-A');
    expect(mandarin?.transcriptionProvider).toBeUndefined();
  });

  /** A session created while the Google-ASR default shipped holds it in its
   *  record, where it stays invalid. Migrated on read, like the interruptible
   *  boolean — otherwise the fix needs a presenter to clear a dropdown by hand. */
  it('migrates a stored Mandarin row that asked for Google transcription', () => {
    const config = resolveRelayConfig({
      languages: [{ code: 'zh-CN', ttsProvider: 'Google', voice: 'cmn-CN-Wavenet-A', transcriptionProvider: 'Google' }],
    });
    expect(config.languages[0].transcriptionProvider).toBeUndefined();
    expect(config.languages[0].voice).toBe('cmn-CN-Wavenet-A');
  });

  /** A session stored before per-language voices existed holds bare tags. It has
   *  to come back as rows with voices, not as rows that inherit an English one. */
  it('migrates a stored list of bare tags to voiced rows', () => {
    const config = resolveRelayConfig({ languages: ['fr-FR', 'ta-IN'] as never });
    const tamil = config.languages.find((l) => l.code === 'ta-IN');
    expect(tamil?.ttsProvider).toBe('ElevenLabs');
    expect(tamil?.voice).toBeTruthy();
    expect(tamil?.voice).not.toBe(DEFAULT_RELAY_CONFIG.voice);
  });

  it('keeps a voice the presenter chose', () => {
    const config = resolveRelayConfig({
      languages: [{ code: 'fr-FR', voice: 'my-own-voice', ttsProvider: 'ElevenLabs' }],
    });
    expect(config.languages[0].voice).toBe('my-own-voice');
  });

  /** The primary language is a `<Language>` too, and it speaks with the parent's
   *  own voice — not the table's default for that tag. */
  it('resolves the primary language with the agent voice', () => {
    const config = resolveRelayConfig({ language: 'en-AU', voice: 'chosen', ttsProvider: 'ElevenLabs' });
    expect(resolvedLanguages(config)[0]).toMatchObject({
      code: 'en-AU',
      voice: 'chosen',
      ttsProvider: 'ElevenLabs',
    });
  });

  it('drops a row whose tag TwiML would reject', () => {
    const config = resolveRelayConfig({
      languages: [{ code: 'ja-JP' }, { code: 'nonsense language' }, { code: '' }] as never,
    });
    expect(languageCodes(config)).toEqual([DEFAULT_RELAY_CONFIG.language, 'ja-JP']);
  });
});
