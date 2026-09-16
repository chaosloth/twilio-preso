import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The two hops are the whole point of these tests: sender → voice application →
 * that application's URL. Each hop has its own way of being wrong, and none of
 * them fails loudly on a real call, so they are asserted here instead.
 */

const senders = vi.fn();
const applications = vi.fn();

vi.mock('twilio', () => ({
  default: () => ({
    messaging: { v2: { channelsSenders: { list: senders } } },
    applications,
    incomingPhoneNumbers: { list: vi.fn() },
    sync: { v1: { services: () => ({ syncMaps: () => ({}) }) } },
  }),
}));

const { describeWhatsAppVoiceWebhook } = await import('../whatsappVoice.js');

const SESSION = 'sess-1';
const EXPECTED = 'https://backend.test/api/voice/conversation-relay?sessionId=sess-1';

function stub(sender: any, app: any) {
  senders.mockResolvedValue(sender ? [sender] : []);
  applications.mockReturnValue({ fetch: async () => (app ? app : Promise.reject(new Error('404'))) });
}

const SENDER = {
  sid: 'XEabc',
  senderId: 'whatsapp:+6560349453',
  status: 'ONLINE',
  configuration: { voiceApplicationSid: 'APabc' },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CONVERSATION_RELAY_URL = 'wss://relay.test';
});

describe('describeWhatsAppVoiceWebhook', () => {
  /** The API rejects a list with no channel outright, so it is never optional. */
  it('asks Twilio only for WhatsApp senders', async () => {
    stub(SENDER, { voiceUrl: EXPECTED, friendlyName: 'CRelay' });
    await describeWhatsAppVoiceWebhook(SESSION);
    expect(senders.mock.calls[0][0]).toMatchObject({ channel: 'whatsapp' });
  });

  it('matches when the application names this session', async () => {
    stub(SENDER, { voiceUrl: EXPECTED, friendlyName: 'CRelay' });
    const result = await describeWhatsAppVoiceWebhook(SESSION);
    expect(result).toMatchObject({
      senderSid: 'XEabc',
      applicationSid: 'APabc',
      applicationName: 'CRelay',
      matches: true,
      reachesThisBackend: true,
    });
  });

  /**
   * The state this check exists for. It reaches this backend, so it looks fine
   * in a log — but a WhatsApp call carries no number the claims map can be keyed
   * by, so no session is inferred and the caller hears the default voice.
   */
  it('separates "reaches this backend" from "names this session"', async () => {
    stub(SENDER, { voiceUrl: 'https://backend.test/api/voice/conversation-relay' });
    const result = await describeWhatsAppVoiceWebhook(SESSION);
    expect(result.matches).toBe(false);
    expect(result.reachesThisBackend).toBe(true);
  });

  /** Another environment or a dev tunnel: this presentation never runs at all. */
  it('reports an application pointing elsewhere', async () => {
    stub(SENDER, { voiceUrl: 'https://leroy.ngrok.io/api/voice/inbound-controller' });
    const result = await describeWhatsAppVoiceWebhook(SESSION);
    expect(result.reachesThisBackend).toBe(false);
  });

  /** No sid at all means WhatsApp calling was never activated on the sender. */
  it('reports a sender with no voice application', async () => {
    stub({ ...SENDER, configuration: {} }, null);
    const result = await describeWhatsAppVoiceWebhook(SESSION);
    expect(result).toMatchObject({ senderSid: 'XEabc', applicationSid: null, registered: null });
    expect(applications).not.toHaveBeenCalled();
  });

  it('reports a sender this account does not have', async () => {
    stub(null, null);
    const result = await describeWhatsAppVoiceWebhook(SESSION);
    expect(result).toMatchObject({ senderSid: null, applicationSid: null, matches: false });
  });

  /** An unreadable application still tells the presenter calling is activated. */
  it('keeps the sid when the application cannot be read', async () => {
    stub(SENDER, null);
    const result = await describeWhatsAppVoiceWebhook(SESSION);
    expect(result).toMatchObject({ applicationSid: 'APabc', registered: null, matches: false });
  });

  it('expects the bot URL when no relay is configured', async () => {
    delete process.env.CONVERSATION_RELAY_URL;
    stub(SENDER, { voiceUrl: EXPECTED });
    const result = await describeWhatsAppVoiceWebhook(SESSION);
    expect(result.expected).toContain('/api/voice/demo-bot');
    expect(result.matches).toBe(false);
  });
});
