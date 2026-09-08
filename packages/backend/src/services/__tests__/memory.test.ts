import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Participant } from '@twilio-preso/shared';
import { askedObservation, refreshTraitSchema, upsertProfile } from '../memory.js';

/**
 * Registration must never mint a second profile for someone the store already
 * knows. Identity Resolution merges on identifiers, so the lookup has to happen
 * by identifier — and by *every* identifier, because an attendee whose first
 * contact was a WhatsApp message has no `phone` identifier to be found by.
 *
 * Every assertion here is about the sequence of HTTP calls, which is the whole
 * behaviour: `fetch` is stubbed and the calls are recorded.
 */
type Call = { method: string; path: string; body: any };

let calls: Call[];
let lookupAnswers: Record<string, string[]>;

function stubFetch() {
  calls = [];
  vi.stubGlobal('fetch', async (url: string, init: any) => {
    const path = String(url).replace('https://memory.twilio.com/v1/Stores/MStest', '');
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init?.method ?? 'GET', path, body });

    if (path.endsWith('/Profiles/Lookup')) {
      return json({ profiles: lookupAnswers[`${body.idType}:${body.value}`] ?? [] });
    }
    if (path.includes('/TraitGroups')) {
      return json({
        traitGroups: [
          { displayName: 'Contact', traits: { firstName: {}, lastName: {}, phone: {} } },
          { displayName: 'live-presentation', traits: { company: {}, role: {} } },
        ],
      });
    }
    if (path === '/Profiles') return json({ id: 'PRnew' });
    return json({ message: 'accepted' });
  });
}

function json(value: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(value) } as unknown as Response;
}

const participant: Participant = {
  id: 'p1',
  name: 'Billy Chan',
  phone: '+6591305079',
  company: 'Twilio',
  role: 'SE',
  registeredAt: Date.now(),
  responses: {},
};

const pathsOf = (method: string) => calls.filter((c) => c.method === method).map((c) => c.path);

beforeEach(() => {
  lookupAnswers = {};
  refreshTraitSchema();
  stubFetch();
});

describe('upsertProfile', () => {
  it('patches the profile the phone identifier already points at', async () => {
    lookupAnswers['phone:+6591305079'] = ['PRexisting'];

    const id = await upsertProfile(participant);

    expect(id).toBe('PRexisting');
    expect(pathsOf('POST')).not.toContain('/Profiles');
    expect(pathsOf('PATCH')).toContain('/Profiles/PRexisting');
  });

  it('finds a profile known only by its WhatsApp identifier', async () => {
    lookupAnswers['whatsapp:whatsapp:+6591305079'] = ['PRwhatsapp'];

    const id = await upsertProfile(participant);

    expect(id).toBe('PRwhatsapp');
    expect(pathsOf('POST')).not.toContain('/Profiles');
  });

  it('creates a profile with no traits, then patches them', async () => {
    const id = await upsertProfile(participant);

    expect(id).toBe('PRnew');
    const create = calls.find((c) => c.path === '/Profiles' && c.method === 'POST');
    expect(create?.body?.traits).toBeUndefined();
    expect(pathsOf('PATCH')).toContain('/Profiles/PRnew');
  });

  it('creates one profile when the same phone registers twice at once', async () => {
    const [a, b] = await Promise.all([upsertProfile(participant), upsertProfile(participant)]);

    expect(a).toBe(b);
    expect(calls.filter((c) => c.path === '/Profiles' && c.method === 'POST')).toHaveLength(1);
  });
});

describe('askedObservation', () => {
  it('reads back as a question the person asked, with their name', () => {
    expect(askedObservation('Ada', 'How do I cut IVR wait times?')).toBe(
      'Ada asked the live AI agent: "How do I cut IVR wait times?"'
    );
  });

  it('keeps the question whole when it already ends in punctuation', () => {
    // Recall is a semantic search over this sentence, so a doubled "??" or a
    // truncated question is a worse match — the text goes in verbatim.
    expect(askedObservation('Ada', 'Why WhatsApp?')).toContain('"Why WhatsApp?"');
  });

  it('is empty for a blank question, so nothing is written', () => {
    expect(askedObservation('Ada', '   ')).toBe('');
  });
});
