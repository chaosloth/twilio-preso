import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProfileContext, lookupProfileByPhone } from '../memory.js';

/**
 * What the text agent needs before it answers: the same three sources the voice
 * agent assembles at setup. The relay has had this for a while; the text agent
 * had only the participant record, so an attendee who registered at a previous
 * event — or texted the number without registering at all — reached an agent
 * that knew nothing about them.
 */
type Call = { method: string; path: string; body: any };

function stub(answers: (path: string) => unknown | undefined): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: any = {}) => {
    const path = String(url).replace('https://memory.twilio.com/v1/Stores/MStest', '');
    calls.push({ method: init.method ?? 'GET', path, body: init.body ? JSON.parse(init.body) : undefined });
    const answer = answers(path);
    if (answer === undefined) return new Response('nope', { status: 404 });
    return new Response(JSON.stringify(answer), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchProfileContext', () => {
  it('reads the declared traits and the recent observations together', async () => {
    const calls = stub((path) => {
      if (path === '/Profiles/mem1') {
        return { traits: { Contact: { firstName: 'Ada' }, 'live-presentation': { theme: 'Dark' } } };
      }
      if (path.startsWith('/Profiles/mem1/Observations')) {
        return { observations: [{ content: 'Asked about SMS' }, { content: '' }] };
      }
      return undefined;
    });

    const ctx = await fetchProfileContext('mem1');

    expect(ctx?.traits.Contact.firstName).toBe('Ada');
    expect(ctx?.traits['live-presentation'].theme).toBe('Dark');
    // Empty observations are dropped rather than becoming blank prompt lines.
    expect(ctx?.observations).toEqual(['Asked about SMS']);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  /** Observations are readable the moment they are written, unlike Recall — so a
   *  half-answered read is still worth having rather than throwing the lot away. */
  it('still returns the traits when the observations read fails', async () => {
    stub((path) => (path === '/Profiles/mem1' ? { traits: { Contact: { firstName: 'Ada' } } } : undefined));
    const ctx = await fetchProfileContext('mem1');
    expect(ctx?.traits.Contact.firstName).toBe('Ada');
    expect(ctx?.observations).toEqual([]);
  });

  it('is null for no profile at all, and never throws at a caller mid-turn', async () => {
    stub(() => undefined);
    expect(await fetchProfileContext(undefined)).toBeNull();
    expect(await fetchProfileContext('gone')).toBeNull();
  });
});

describe('lookupProfileByPhone', () => {
  /**
   * The path that makes an unregistered texter known: they are in no participant
   * map, but the phone identifier is what Identity Resolution merges on. Tried
   * as `whatsapp:` too — a profile whose only identifier came from a WhatsApp
   * message is exactly the one a phone-only lookup misses.
   */
  it('finds a profile by the phone identifier, then by the WhatsApp one', async () => {
    const calls = stub((path) => (path === '/Profiles/Lookup' ? { profiles: [] } : undefined));
    expect(await lookupProfileByPhone('+61400000000')).toBeNull();
    expect(calls.map((c) => c.body)).toEqual([
      { idType: 'phone', value: '+61400000000' },
      { idType: 'whatsapp', value: 'whatsapp:+61400000000' },
    ]);
  });

  it('is null for no number rather than looking one up', async () => {
    const calls = stub(() => undefined);
    expect(await lookupProfileByPhone(null)).toBeNull();
    expect(calls).toEqual([]);
  });
});
