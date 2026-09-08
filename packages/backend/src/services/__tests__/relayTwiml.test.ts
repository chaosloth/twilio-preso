import { describe, expect, it } from 'vitest';
import { resolveRelayConfig } from '@twilio-preso/shared';
import { relayTwiml } from '../../routes/trigger.js';

const twiml = (overrides = {}) =>
  relayTwiml(null, resolveRelayConfig(overrides), 'wss://relay.example.com');

/**
 * Twilio's own best-practices page names two attributes this app was not
 * sending. Both are on the parent noun, and both are silent when absent — which
 * is why they are asserted here rather than noticed on a live call.
 */
describe('relayTwiml', () => {
  /**
   * ElevenLabs can speak "$20.50" as words instead of characters. It costs
   * latency, so it stays a per-session choice — but the chosen value is stated
   * rather than left to the platform default, the same lesson `zh-CN` taught.
   */
  it('states the ElevenLabs text normalization it wants', () => {
    expect(twiml()).toContain('elevenlabsTextNormalization="off"');
    expect(twiml({ textNormalization: 'on' })).toContain('elevenlabsTextNormalization="on"');
  });

  /** The attribute belongs to one provider. Sending it alongside a Google voice
   *  describes a pairing that does not exist. */
  it('omits it when the voice is not an ElevenLabs one', () => {
    const google = twiml({ ttsProvider: 'Google', voice: 'en-AU-Neural2-B', textNormalization: 'on' });
    expect(google).not.toContain('elevenlabsTextNormalization');
  });

  /** Conversation Intelligence, for transcripts and operators after the call.
   *  Empty means the account has no service, and an empty attribute is a 64101. */
  it('connects a Conversation Intelligence service only when one is configured', () => {
    expect(twiml()).not.toContain('intelligenceService');
    expect(twiml({ intelligenceService: 'GA1234' })).toContain('intelligenceService="GA1234"');
  });
});
