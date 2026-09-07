import { config } from '../config.js';
import { STAGE_LIBRARY } from '@twilio-preso/shared';
import type { Participant, ParticipantResponse } from '@twilio-preso/shared';

/**
 * Twilio Conversation Memory — the durable customer profile behind the demo.
 *
 * Sync holds what this session's phones have said; Conversation Memory holds who
 * the person *is*, across sessions and channels. Both matter: Sync is the live
 * tally on the big screen, memory is the thing the voice agent recalls.
 *
 * The whole module is **optional and best-effort**. Without
 * `TWILIO_MEMORY_STORE_ID` every function is a no-op returning `null`, and every
 * call site falls back to the Sync `responses` path. A memory failure must never
 * fail a join, a response, or a trigger — the person is standing in a room
 * waiting for their phone to work.
 *
 * There is no Node SDK surface for these endpoints yet, so this is a small
 * basic-auth fetch client over the REST API.
 *
 * Two shapes of the API are easy to get wrong and both fail loudly only in
 * production logs:
 *
 * - **Traits are grouped and declared.** The payload is
 *   `{traits: {<groupName>: {<trait>: value}}}`, and a trait that is not
 *   declared in the store's settings is rejected with a bare 400 — so the
 *   payload is filtered against the store's *actual* schema (read once and
 *   cached) rather than assumed. `Contact` ships with every store; the
 *   `Wonder` group holding company and role does not, which is why the HUD can
 *   both report it missing and create it.
 * - **Everything the audience *says* is an observation, not a trait.** Traits
 *   are stable facts with a fixed schema; a word-cloud answer is neither. Recall
 *   is a semantic search over observations, so this is also the only shape that
 *   the memory SMS and the voice agent can actually read back.
 */

const BASE = 'https://memory.twilio.com/v1';

/** Absent store id = feature off. Deliberately not `requireEnv`. */
export function isMemoryEnabled(): boolean {
  return !!config.twilio.memoryStoreId;
}

function authHeader(): string {
  const { accountSid, authToken } = config.twilio;
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
}

async function memoryFetch<T>(path: string, body?: unknown, method = 'POST'): Promise<T | null> {
  const storeId = config.twilio.memoryStoreId;
  if (!storeId) return null;

  // Profile paths hang off the store; the store itself lives on the control
  // plane (`/v1/ControlPlane/Stores/{id}`), not under its own data path, so a
  // `/v1/`-prefixed path here is taken as absolute rather than store-relative.
  const url = path.startsWith('/v1/')
    ? `https://memory.twilio.com${path}`
    : `${BASE}/Stores/${storeId}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`memory ${method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  // Writes answer 202 with only a message; reads return the resource.
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

/** Twilio's identifier type for a phone number — one of the store's default
 *  identity rules (`chat`, `email`, `phone`, `pushUserID`, `whatsapp`). Identity
 *  Resolution merges profiles that share one, which is what makes a returning
 *  attendee the same person rather than a new profile. */
const PHONE_ID_TYPE = 'phone';

/** The trait group every store ships with. Using it means a join works with no
 *  Console configuration at all. */
const CONTACT_GROUP = 'Contact';

/** The group this app declares for the attributes registration always collects
 *  but `Contact` has no field for. Created on demand from the HUD. */
const WONDER_GROUP = 'Wonder';

/**
 * The traits this app writes, by group. Registration collects exactly these, so
 * they are a fixed schema rather than free text — which is the whole reason they
 * are traits and not observations.
 *
 * `Contact` is only listed so the HUD can say whether the defaults are still
 * there; nothing here tries to create it.
 */
export const DESIRED_TRAITS: Record<string, Record<string, { dataType: string; description: string }>> = {
  [CONTACT_GROUP]: {
    firstName: { dataType: 'STRING', description: 'Given name' },
    lastName: { dataType: 'STRING', description: 'Family name' },
    phone: { dataType: 'STRING', description: 'Mobile number in E.164' },
  },
  [WONDER_GROUP]: {
    company: { dataType: 'STRING', description: 'Company the attendee gave at registration' },
    role: { dataType: 'STRING', description: 'Job role the attendee gave at registration' },
  },
};

/** Groups this app will create itself. `Contact` is Twilio's, not ours. */
const OWNED_GROUPS = [WONDER_GROUP];

interface TraitGroupsResponse {
  traitGroups?: Array<{ displayName?: string; traits?: Record<string, unknown> }>;
}

/**
 * The store's declared schema, group -> trait names.
 *
 * Cached for the process lifetime: an undeclared trait is a hard 400, so every
 * profile write needs this, and it only changes when someone edits the store.
 * `refreshTraitSchema` clears it after a create so the HUD's next check is
 * honest rather than repeating what it saw before.
 */
let schemaCache: Promise<Record<string, Set<string>>> | null = null;

async function readTraitSchema(): Promise<Record<string, Set<string>>> {
  const res = await memoryFetch<TraitGroupsResponse>(
    `/v1/ControlPlane/Stores/${config.twilio.memoryStoreId}/TraitGroups?includeTraits=true`,
    undefined,
    'GET'
  );
  const out: Record<string, Set<string>> = {};
  for (const group of res?.traitGroups ?? []) {
    if (!group.displayName) continue;
    out[group.displayName] = new Set(Object.keys(group.traits ?? {}));
  }
  return out;
}

function traitSchema(): Promise<Record<string, Set<string>>> {
  if (!schemaCache) {
    // A failed read must not be cached as "nothing is declared", or every
    // subsequent write silently drops its traits.
    schemaCache = readTraitSchema().catch((err) => {
      schemaCache = null;
      throw err;
    });
  }
  return schemaCache;
}

export function refreshTraitSchema(): void {
  schemaCache = null;
}

/** Stamped on every observation this app writes, so the audience's answers are
 *  distinguishable from anything another Twilio product recorded. */
const OBSERVATION_SOURCE = 'wonder-preso';

/**
 * Registration collects one display name; `Contact` declares first and last
 * separately. Everything after the first space is the surname — wrong for some
 * names, but a name badge is not an identity document and the alternative is
 * discarding half of what they typed.
 */
function splitName(name: string): { firstName: string; lastName?: string } {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() || name.trim();
  const lastName = parts.join(' ');
  return lastName ? { firstName, lastName } : { firstName };
}

/** The declared `Contact` traits a registration knows. */
export function contactTraits(participant: Participant): Record<string, string> {
  return { ...splitName(participant.name), phone: participant.phone };
}

/** The `Wonder` traits a registration knows. Empty when the attendee skipped
 *  both fields — an empty group is not sent. */
export function wonderTraits(participant: Participant): Record<string, string> {
  const traits: Record<string, string> = {};
  if (participant.company) traits.company = participant.company;
  if (participant.role) traits.role = participant.role;
  return traits;
}

/**
 * The grouped trait payload for a participant, filtered to what the store
 * actually declares. Anything undeclared is dropped rather than sent: one
 * unknown key rejects the whole write with a bare 400, which would cost the
 * attendee their name as well as their company.
 *
 * Dropped traits are not lost — `introObservation` still records company and
 * role as a sentence, which is also the only form `Recall` can read back.
 */
export async function traitPayload(
  participant: Participant
): Promise<Record<string, Record<string, string>>> {
  const wanted: Record<string, Record<string, string>> = {
    [CONTACT_GROUP]: contactTraits(participant),
    [WONDER_GROUP]: wonderTraits(participant),
  };

  const declared = await traitSchema().catch(() => null);
  // Schema unreadable: send `Contact` alone, which every store ships with, so a
  // control-plane blip costs the demo its company trait and not the join.
  if (!declared) return { [CONTACT_GROUP]: wanted[CONTACT_GROUP] };

  const payload: Record<string, Record<string, string>> = {};
  for (const [group, traits] of Object.entries(wanted)) {
    const allowed = declared[group];
    if (!allowed) continue;
    const kept = Object.fromEntries(Object.entries(traits).filter(([key]) => allowed.has(key)));
    if (Object.keys(kept).length > 0) payload[group] = kept;
  }
  return payload;
}

/** Company and role are traits *and* a sentence: only observations are
 *  semantically indexed, so this is what the voice agent can recall. */
export function introObservation(participant: Participant): string | null {
  if (participant.company && participant.role) {
    return `${participant.name} works at ${participant.company} as ${participant.role}.`;
  }
  if (participant.company) return `${participant.name} works at ${participant.company}.`;
  if (participant.role) return `${participant.name}'s role is ${participant.role}.`;
  return null;
}

/**
 * An answer as a recallable sentence. The stage's own prompt is included when
 * the library has one: "slow responses" recalls far better as an answer to a
 * question than as a bare fragment.
 */
export function responseObservation(
  participant: Participant,
  response: ParticipantResponse
): string {
  const prompt = STAGE_LIBRARY[response.stageId]?.interaction?.prompt;
  return prompt
    ? `Asked "${prompt}", ${participant.name} answered "${response.value}".`
    : `${participant.name} answered "${response.value}".`;
}

async function lookupByPhone(phone: string): Promise<string | null> {
  // `profiles` is an array of profile id strings, not of objects.
  const result = await memoryFetch<{ profiles?: string[] }>('/Profiles/Lookup', {
    idType: PHONE_ID_TYPE,
    value: phone,
  });
  return result?.profiles?.[0] ?? null;
}

/**
 * Resolves the participant to a Customer Profile, creating one if this phone has
 * never attended before. Lookup first: a returning attendee must land on their
 * existing profile, or the memory demo is just an echo of this session.
 *
 * Returns the profile id to store on the participant, or `null` when memory is
 * off or unreachable.
 */
export async function upsertProfile(participant: Participant): Promise<string | null> {
  if (!isMemoryEnabled()) return null;

  const traits = await traitPayload(participant);

  const existing = await lookupByPhone(participant.phone);
  if (existing) {
    // Patching merges, so this adds what's new without clearing anything a
    // previous event learned about them.
    await memoryFetch(`/Profiles/${existing}`, { traits }, 'PATCH');
    await recordObservationFor(existing, participant);
    return existing;
  }

  // Create answers with `{id, message}` — not `sid`, and not the profile body.
  const created = await memoryFetch<{ id?: string }>('/Profiles', { traits });
  const profileId = created?.id;
  if (!profileId) return null;

  // The identifier is what Identity Resolution matches on next time; the phone
  // trait alone is not enough, though it does carry an `idTypePromotion`.
  await memoryFetch(`/Profiles/${profileId}/Identifiers`, {
    idType: PHONE_ID_TYPE,
    value: participant.phone,
  });
  await recordObservationFor(profileId, participant);

  return profileId;
}

async function recordObservationFor(profileId: string, participant: Participant): Promise<void> {
  const intro = introObservation(participant);
  if (intro) await recordObservation(profileId, intro);
}

/**
 * Writes one free-text observation, semantically indexed for `recall`. This is
 * where everything the audience says ends up.
 */
export async function recordObservation(
  profileId: string | undefined,
  content: string
): Promise<void> {
  if (!isMemoryEnabled() || !profileId || !content.trim()) return;
  await memoryFetch(`/Profiles/${profileId}/Observations`, {
    observations: [
      {
        content,
        source: OBSERVATION_SOURCE,
        occurredAt: new Date().toISOString(),
      },
    ],
  });
}

/**
 * One cheap read against the store, so the HUD can say "configured *and*
 * reachable" rather than only "configured". `ok: false` with no store id means
 * the feature is off, which is not an error — callers distinguish the two.
 */
export async function probeMemoryStore(): Promise<{ ok: boolean; detail: string }> {
  if (!isMemoryEnabled()) return { ok: false, detail: 'not configured' };
  try {
    const store = await memoryFetch<{ display_name?: string; displayName?: string }>(
      `/v1/ControlPlane/Stores/${config.twilio.memoryStoreId}`,
      undefined,
      'GET'
    );
    return {
      ok: true,
      detail: store?.displayName || store?.display_name || config.twilio.memoryStoreId,
    };
  } catch (err: any) {
    return { ok: false, detail: err?.message ?? 'unreachable' };
  }
}

/**
 * Asks the profile a question in natural language and returns whatever it
 * recalls, or `null` if memory is off, the profile is unknown, or nothing was
 * remembered. Callers treat `null` as "fall back to the Sync responses".
 */
export async function recall(
  profileId: string | undefined,
  query: string
): Promise<string | null> {
  if (!isMemoryEnabled() || !profileId) return null;
  const result = await memoryFetch<{
    observations?: Array<{ content?: string }>;
    summaries?: Array<{ content?: string }>;
  }>(`/Profiles/${profileId}/Recall`, { query, observationsLimit: 5, summariesLimit: 1 });

  const parts = [
    ...(result?.summaries ?? []).map((s) => s.content),
    ...(result?.observations ?? []).map((o) => o.content),
  ].filter((c): c is string => !!c && c.trim().length > 0);

  return parts.length ? parts.join(' ') : null;
}

/** One missing piece of the declared schema. A missing group implies all of its
 *  traits, so the group is reported once rather than per trait. */
export interface MissingTrait {
  group: string;
  /** Absent when the whole group is missing. */
  trait?: string;
}

/**
 * Which of `DESIRED_TRAITS` the store does not declare. Surfaced in the HUD
 * because the failure mode is invisible otherwise: an undeclared trait is
 * silently filtered out of every profile write, so the demo runs and the
 * personalization is just quietly thinner than intended.
 */
export async function probeMemoryTraits(): Promise<{
  ok: boolean;
  missing: MissingTrait[];
  detail: string;
}> {
  if (!isMemoryEnabled()) return { ok: false, missing: [], detail: 'not configured' };
  let declared: Record<string, Set<string>>;
  try {
    declared = await traitSchema();
  } catch (err: any) {
    return { ok: false, missing: [], detail: err?.message ?? 'trait schema unreadable' };
  }

  const missing: MissingTrait[] = [];
  for (const [group, traits] of Object.entries(DESIRED_TRAITS)) {
    const present = declared[group];
    if (!present) {
      missing.push({ group });
      continue;
    }
    for (const trait of Object.keys(traits)) {
      if (!present.has(trait)) missing.push({ group, trait });
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    detail: missing.length === 0 ? 'every trait this app writes is declared' : describeMissing(missing),
  };
}

function describeMissing(missing: MissingTrait[]): string {
  return missing
    .map((m) => (m.trait ? `${m.group}.${m.trait}` : `${m.group} (whole group)`))
    .join(', ');
}

/**
 * Creates the trait groups and traits this app owns. An explicit presenter
 * action, never automatic: it edits the account's memory schema, which outlives
 * the presentation, so it should not be a side effect of loading a HUD tab.
 *
 * `Contact` is Twilio's own group — if one of its defaults has been removed, say
 * so instead of writing to it. Both endpoints answer 202 and index
 * asynchronously, so the schema cache is cleared rather than updated in place.
 */
export async function ensureTraitGroups(): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  const declared = await traitSchema();

  for (const group of OWNED_GROUPS) {
    const traits = DESIRED_TRAITS[group];
    const present = declared[group];

    if (!present) {
      await memoryFetch(`/v1/ControlPlane/Stores/${config.twilio.memoryStoreId}/TraitGroups`, {
        displayName: group,
        description: 'Attributes collected when an attendee registers for a live presentation.',
        traits,
      });
      created.push(group);
      continue;
    }

    // PATCH merges, so only the absent traits are sent — and nothing another
    // event declared on the same group is cleared.
    const absent = Object.fromEntries(
      Object.entries(traits).filter(([trait]) => !present.has(trait))
    );
    if (Object.keys(absent).length === 0) continue;
    await memoryFetch(
      `/v1/ControlPlane/Stores/${config.twilio.memoryStoreId}/TraitGroups/${group}`,
      { traits: absent },
      'PATCH'
    );
    created.push(...Object.keys(absent).map((t) => `${group}.${t}`));
  }

  for (const [group, traits] of Object.entries(DESIRED_TRAITS)) {
    if (OWNED_GROUPS.includes(group)) continue;
    const present = declared[group];
    for (const trait of Object.keys(traits)) {
      if (!present?.has(trait)) skipped.push(`${group}.${trait}`);
    }
  }

  refreshTraitSchema();
  return { created, skipped };
}
