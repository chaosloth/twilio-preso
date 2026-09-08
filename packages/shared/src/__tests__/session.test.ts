import { describe, expect, it } from 'vitest';
import { toPublicSession, verifyChannelFor } from '../session.js';
import type { SessionRecord } from '../session.js';

const base: SessionRecord = {
  id: 's1',
  joinCode: 'ABCD',
  title: 'Wonder',
  ownerPhone: '+61400000000',
  deck: [],
  phoneNumber: '+61400000001',
  status: 'live',
  createdAt: Date.now(),
};

/**
 * Which channel carries the one-time passcode is a per-event decision — a room
 * whose WhatsApp templates are not approved yet needs SMS — so the phone has to
 * be told before it shows the choice.
 */
describe('verify channel', () => {
  it('defaults to WhatsApp — the channel the talk is about', () => {
    expect(verifyChannelFor(base)).toBe('whatsapp');
    expect(toPublicSession(base).verifyChannel).toBe('whatsapp');
  });

  it('honours a session set to SMS', () => {
    expect(verifyChannelFor({ ...base, verifyChannel: 'sms' })).toBe('sms');
    expect(toPublicSession({ ...base, verifyChannel: 'sms' }).verifyChannel).toBe('sms');
  });

  it('falls back rather than trusting a hand-edited record', () => {
    expect(verifyChannelFor({ ...base, verifyChannel: 'telegram' as never })).toBe('whatsapp');
  });
});
