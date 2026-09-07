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
 *   declared in the store's settings is rejected with a bare 400. Only the
 *   default `Contact` group is assumed here, so nothing has to be configured in
 *   the Console before a join works.
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

/** The trait group every store ships with. Using it means the demo needs no
 *  Console configuration to work. */
const CONTACT_GROUP = 'Contact';

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

/** Company and role are not in the default schema, so they are recorded as a
 *  sentence rather than dropped or written as undeclared traits. */
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

  const traits = { [CONTACT_GROUP]: contactTraits(participant) };

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
