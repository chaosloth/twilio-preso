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
