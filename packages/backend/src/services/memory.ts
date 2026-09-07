import { config } from '../config.js';
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
  // A 204 has no body; PATCH/POST here normally return the profile.
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

interface ProfileResource {
  sid?: string;
  profile_id?: string;
  traits?: Record<string, unknown>;
}

/** Twilio's identifier type for a phone number. Identity Resolution merges
 *  profiles that share one, which is what makes a returning attendee the same
 *  person rather than a new profile. */
const PHONE_ID_TYPE = 'phone_number';

function profileIdOf(resource: ProfileResource | null): string | null {
  return resource?.profile_id ?? resource?.sid ?? null;
}

/** The traits a registration knows. Empty values are dropped rather than
 *  written as `''`, since a blank trait is worse than an absent one on recall. */
export function traitsForParticipant(participant: Participant): Record<string, string> {
  const traits: Record<string, string> = { name: participant.name, phone: participant.phone };
  if (participant.company) traits.company = participant.company;
  if (participant.role) traits.role = participant.role;
  return traits;
}

/** One trait per answered stage, keyed by stage id — the same key Sync uses, so
 *  a reordered deck cannot make this read a different stage's answer. */
export function traitsForResponse(response: ParticipantResponse): Record<string, string> {
  return { [`response_${response.stageId}`]: response.value };
}

async function lookupByPhone(phone: string): Promise<string | null> {
  const result = await memoryFetch<{ profiles?: ProfileResource[] }>('/Profiles/Lookup', {
    idType: PHONE_ID_TYPE,
    value: phone,
  });
  return profileIdOf(result?.profiles?.[0] ?? null);
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

  const traits = traitsForParticipant(participant);

  const existing = await lookupByPhone(participant.phone);
  if (existing) {
    // PatchProfileTraits merges, so this adds what's new without clearing
    // anything a previous event learned about them.
    await memoryFetch(`/Profiles/${existing}`, { traits }, 'PATCH');
    return existing;
  }

  const created = await memoryFetch<ProfileResource>('/Profiles', { traits });
  const profileId = profileIdOf(created);
  if (!profileId) return null;

  // The identifier is what Identity Resolution matches on next time; the phone
  // trait alone is not indexed for lookup.
  await memoryFetch(`/Profiles/${profileId}/Identifiers`, {
    idType: PHONE_ID_TYPE,
    value: participant.phone,
  });

  return profileId;
}

/**
 * One cheap read against the store, so the HUD can say "configured *and*
 * reachable" rather than only "configured". `ok: false` with no store id means
 * the feature is off, which is not an error — callers distinguish the two.
 */
export async function probeMemoryStore(): Promise<{ ok: boolean; detail: string }> {
  if (!isMemoryEnabled()) return { ok: false, detail: 'not configured' };
  try {
    const store = await memoryFetch<{ display_name?: string; store_id?: string }>(
      `/v1/ControlPlane/Stores/${config.twilio.memoryStoreId}`,
      undefined,
      'GET'
    );
    return { ok: true, detail: store?.display_name || config.twilio.memoryStoreId };
  } catch (err: any) {
    return { ok: false, detail: err?.message ?? 'unreachable' };
  }
}

/** Merges new traits into an existing profile. No-op without a profile id. */
export async function patchTraits(
  profileId: string | undefined,
  traits: Record<string, string>
): Promise<void> {
  if (!isMemoryEnabled() || !profileId || Object.keys(traits).length === 0) return;
  await memoryFetch(`/Profiles/${profileId}`, { traits }, 'PATCH');
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
