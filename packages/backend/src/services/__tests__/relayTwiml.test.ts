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

/**
 * Two internal-only ConversationRelay features. Both are gated on account flags
 * (TwiML Sessions 50030, plus 1267 for ambience and 1265 for Flux), so the
 * attributes must be absent unless the session actually asked for them — an
 * account without the flag reads an unknown attribute as a 64101.
 */
describe('agent ambient sound', () => {
  /** No URL, no attributes. The default must be sendable on any account. */
  it('says nothing about ambience by default', () => {
    expect(twiml()).not.toContain('agentAmbientSound');
    expect(twiml()).not.toContain('ambientSoundGain');
  });

  /** Gain rides along with the URL: it means nothing on its own. */
  it('emits the loop and its gain when a URL is configured', () => {
    const out = twiml({ ambientSound: 'https://media.example.com/room.wav', ambientSoundGain: 0.3 });
    expect(out).toContain('agentAmbientSound="https://media.example.com/room.wav"');
    expect(out).toContain('ambientSoundGain="0.3"');
  });

  /** A gain with no file is a volume for silence. */
  it('omits the gain when there is no loop to set it on', () => {
    expect(twiml({ ambientSoundGain: 0.9 })).not.toContain('ambientSoundGain');
  });
});

describe('Deepgram Flux TTS', () => {
  /** Flux is selected by the *voice name* under ttsProvider="Deepgram" —
   *  Twilio detects the Flux name and routes to it internally. */
  it('names Deepgram as the provider and the Flux voice verbatim', () => {
    const out = twiml({ ttsProvider: 'Deepgram', voice: 'flux-kai-en-1.2_-1' });
    expect(out).toContain('ttsProvider="Deepgram"');
    expect(out).toContain('voice="flux-kai-en-1.2_-1"');
  });

  /** Neither an ElevenLabs attribute nor `multi`: Flux is English-only and the
   *  normalization attribute belongs to another provider. */
  it('drops the ElevenLabs-only attribute and auto language detection', () => {
    const out = twiml({ ttsProvider: 'Deepgram', voice: 'flux-kai-en', textNormalization: 'on' });
    expect(out).not.toContain('elevenlabsTextNormalization');
    expect(out).toContain('language="en-AU"');
  });
});
