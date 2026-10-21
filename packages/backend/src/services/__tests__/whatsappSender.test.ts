import { describe, expect, it, vi } from 'vitest';

vi.mock('twilio', () => ({ default: () => ({ messaging: { v2: { channelsSenders: { list: vi.fn() } } } }) }));

const { chooseWhatsAppSender } = await import('../whatsappSender.js');

const POOL = ['+6560349453', '+61468157727'];
const GLOBAL = 'whatsapp:+6560349453';

/**
 * Session F97RSF claimed +61468157727 and its WhatsApp went out from
 * +6560349453 — the other session's number — because every send used the one
 * global sender.
 */
describe('chooseWhatsAppSender', () => {
  it("uses the session's own number when it is a registered sender", () => {
    const registered = new Set(['whatsapp:+6560349453', 'whatsapp:+61468157727']);
    expect(chooseWhatsAppSender('+61468157727', registered, GLOBAL, POOL)).toBe('whatsapp:+61468157727');
    expect(chooseWhatsAppSender('+6560349453', registered, GLOBAL, POOL)).toBe('whatsapp:+6560349453');
  });

  it("never sends from another session's pool number — SMS instead", () => {
    const registered = new Set(['whatsapp:+6560349453']);
    expect(chooseWhatsAppSender('+61468157727', registered, GLOBAL, POOL)).toBe('');
  });

  it('falls back to a global sender that is not a pool number', () => {
    const registered = new Set(['whatsapp:+14155550000']);
    expect(chooseWhatsAppSender('+61468157727', registered, 'whatsapp:+14155550000', POOL)).toBe(
      'whatsapp:+14155550000'
    );
  });

  it('still prefers its own number when the sender list cannot be read', () => {
    expect(chooseWhatsAppSender('+6560349453', null, GLOBAL, POOL)).toBe(GLOBAL);
    expect(chooseWhatsAppSender('+61468157727', null, GLOBAL, POOL)).toBe('');
  });

  it('sends nothing on WhatsApp when no sender is configured', () => {
    expect(chooseWhatsAppSender('+61468157727', new Set(), '', POOL)).toBe('');
  });
});
