import { config } from './config.js';

/**
 * Conversation Memory recall for the voice agent.
 *
 * Deliberately a second, much smaller client than the backend's
 * `services/memory.ts`: the relay is a standalone process with its own env and
 * no HTTP route into the backend, and all it ever needs is one read. Writes stay
 * on the backend side.
 *
 * Returns `null` whenever memory is unconfigured, the profile is unknown, or the
 * request fails — the agent then falls back to this session's Sync responses.
 */

function storeId(): string | undefined {
  return process.env.TWILIO_MEMORY_STORE_ID;
}

function authHeaders(): Record<string, string> {
  const auth = Buffer.from(
    `${config.twilio.accountSid}:${config.twilio.authToken}`
  ).toString('base64');
  return { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
}

async function memoryGet<T>(path: string): Promise<T | null> {
  if (!storeId()) return null;
  try {
    const res = await fetch(`https://memory.twilio.com/v1/Stores/${storeId()}${path}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.error(`Memory GET ${path} failed:`, err);
    return null;
  }
}

/** What the agent knows about the caller before it says a word. */
export interface ProfileContext {
  /** Declared traits, group -> trait -> value. Stable facts: name, company, role. */
  traits: Record<string, Record<string, string>>;
  /** Most recent observations, newest first. What they have actually said. */
  observations: string[];
}

/**
 * The caller's durable profile: traits *and* observations.
 *
 * Both halves are needed and they are not interchangeable. Traits are the
 * declared schema — who this person is — and are the only place the name,
 * company and role live reliably. Observations are everything they have said,
 * here and at previous events, and unlike `Recall` they are returned in
 * chronological order the moment they are written rather than once the semantic
 * index catches up — which matters when the call lands seconds after the poll.
 */
export async function fetchProfileContext(
  profileId: string | undefined
): Promise<ProfileContext | null> {
  if (!profileId) return null;

  const [profile, observations] = await Promise.all([
    memoryGet<{ traits?: Record<string, Record<string, string>> }>(`/Profiles/${profileId}`),
    memoryGet<{ observations?: Array<{ content?: string }> }>(
      `/Profiles/${profileId}/Observations?pageSize=15`
    ),
  ]);
  if (!profile && !observations) return null;

  return {
    traits: profile?.traits ?? {},
    observations: (observations?.observations ?? [])
      .map((o) => o.content)
      .filter((c): c is string => !!c && c.trim().length > 0),
  };
}

/**
 * Finds a profile from the caller's number alone.
 *
 * The path that makes calling *in* work: an inbound caller may not be in this
 * session's participant map at all — they attended a previous event, or rang the
 * number without registering — and the phone identifier is exactly what Identity
 * Resolution merges on, so it resolves them anyway.
 */
export async function lookupProfileByPhone(phone: string | null): Promise<string | null> {
  if (!storeId() || !phone) return null;
  try {
    const res = await fetch(
      `https://memory.twilio.com/v1/Stores/${storeId()}/Profiles/Lookup`,
      {
        method: 'POST',
        headers: authHeaders(),
        // `phone`, not `phone_number` — the store's identity rule names.
        body: JSON.stringify({ idType: 'phone', value: phone }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { profiles?: string[] };
    return data.profiles?.[0] ?? null;
  } catch (err) {
    console.error('Memory lookup failed:', err);
    return null;
  }
}
export async function recallForProfile(
  profileId: string | undefined,
  query: string
): Promise<string | null> {
  const storeId = process.env.TWILIO_MEMORY_STORE_ID;
  if (!storeId || !profileId) return null;

  try {
    const auth = Buffer.from(
      `${config.twilio.accountSid}:${config.twilio.authToken}`
    ).toString('base64');
    const res = await fetch(
      `https://memory.twilio.com/v1/Stores/${storeId}/Profiles/${profileId}/Recall`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, observationsLimit: 5, summariesLimit: 1 }),
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      observations?: Array<{ content?: string }>;
      summaries?: Array<{ content?: string }>;
    };
    const parts = [
      ...(data.summaries ?? []).map((s) => s.content),
      ...(data.observations ?? []).map((o) => o.content),
    ].filter((c): c is string => !!c && c.trim().length > 0);
    return parts.length ? parts.join(' ') : null;
  } catch (err) {
    console.error('Memory recall failed:', err);
    return null;
  }
}
