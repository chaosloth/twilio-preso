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
/** Profile ids an identifier points at but the store no longer has — a profile
 *  deleted in the Console leaves exactly this behind. */
let deletedProfiles: Set<string>;

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
    // The store requires traits on create: a bare `{}` is a 400, not an empty
    // profile waiting for a PATCH.
    if (path === '/Profiles') {
      if (!body?.traits || Object.keys(body.traits).length === 0) {
        return error(400, 'Traits are required to create a profile');
      }
      return json({ id: 'PRnew' });
    }
    const target = path.match(/^\/Profiles\/([^/]+)/)?.[1];
    if (target && deletedProfiles.has(target)) return error(404, 'Profile not found');
    return json({ message: 'accepted' });
  });
}

function error(status: number, message: string) {
  return {
    ok: false,
    status,
    text: async () => JSON.stringify({ code: status, message }),
  } as unknown as Response;
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
  deletedProfiles = new Set();
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

  /**
   * The store rejects a create that carries no traits — "Traits are required to
   * create a profile", a 400. Creating bare and patching after is therefore not
   * a safer split of one write, it is a write that never lands: every new
   * attendee silently got no profile at all, and the only findable profile was
   * whichever one an earlier event had already made.
   */
  it('creates the profile with its traits, since a bare create is rejected', async () => {
    const id = await upsertProfile(participant);

    expect(id).toBe('PRnew');
    const create = calls.find((c) => c.path === '/Profiles' && c.method === 'POST');
    expect(create?.body?.traits?.Contact?.firstName).toBe('Billy');
    expect(create?.body?.traits?.['live-presentation']?.company).toBe('Twilio');
  });

  /**
   * A profile deleted in the Console can still be what Lookup answers with. The
   * patch onto it 404s, and that used to abort the whole upsert — leaving the
   * attendee with no profile and no second attempt, on the one path that was
   * supposed to be the safe one.
   */
  it('creates a new profile when the one an identifier points at is gone', async () => {
    lookupAnswers['phone:+6591305079'] = ['PRdead'];
    deletedProfiles.add('PRdead');

    const id = await upsertProfile(participant);

    expect(id).toBe('PRnew');
    expect(calls.find((c) => c.path === '/Profiles' && c.method === 'POST')).toBeTruthy();
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
