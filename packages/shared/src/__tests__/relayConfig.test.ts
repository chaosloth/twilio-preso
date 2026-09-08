import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RELAY_CONFIG,
  RELAY_TOOLS,
  relayToolPrompt,
  resolveRelayConfig,
  INTERRUPT_MODES,
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
