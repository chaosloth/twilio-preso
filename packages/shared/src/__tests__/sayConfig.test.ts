import { describe, expect, it } from 'vitest';
import { DEFAULT_SAY_CONFIG, SAY_MAX_LOOP, resolveSayConfig, sayVoiceAttribute } from '../sayConfig.js';

describe('resolveSayConfig', () => {
  it('defaults to the mass-call ElevenLabs voice', () => {
    expect(resolveSayConfig()).toEqual(DEFAULT_SAY_CONFIG);
    expect(sayVoiceAttribute(resolveSayConfig())).toBe('ElevenLabs.sai9UY7iXkRDSsXHR0bZ');
  });

  /** `loop="0"` is "until hang-up" to TwiML — never acceptable on a room-wide call. */
  it('bounds loop and never lets it reach zero', () => {
    expect(resolveSayConfig({ loop: 0 }).loop).toBe(1);
    expect(resolveSayConfig({ loop: 99 }).loop).toBe(SAY_MAX_LOOP);
  });

  it('rejects values that would break the TwiML', () => {
    const c = resolveSayConfig({
      provider: 'Acme' as never,
      voice: 'x" onload="y',
      language: 'not a tag',
      message: '   ',
    });
    expect(c.provider).toBe('ElevenLabs');
    expect(c.voice).toBe(DEFAULT_SAY_CONFIG.voice);
    expect(c.language).toBe('');
    expect(c.message).toBe(DEFAULT_SAY_CONFIG.message);
  });

  it("falls back to the provider's own preset, not another provider's voice", () => {
    expect(resolveSayConfig({ provider: 'Polly', voice: '' }).voice).toBe('Joanna-Neural');
  });

  it('copies only declared fields', () => {
    expect(resolveSayConfig({ extra: 1 } as never)).not.toHaveProperty('extra');
  });

  it('drops ElevenLabs relay tuning suffixes from the <Say> voice', () => {
    expect(sayVoiceAttribute(resolveSayConfig({ voice: 'abc123-flash_v2' }))).toBe('ElevenLabs.abc123');
  });
});
