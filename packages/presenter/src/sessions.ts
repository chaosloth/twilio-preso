import { resolveDeck } from '@twilio-preso/shared';
import type { DeckWarning, PhonePoolUsage, ResolvedStage, SessionRecord } from '@twilio-preso/shared';
import { presenterFetch } from './auth';

export interface SessionWithWarnings {
  session: SessionRecord;
  warnings: DeckWarning[];
}

async function json(res: Response): Promise<any> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`) as Error & {
      status: number;
      inUse?: PhonePoolUsage[];
    };
    err.status = res.status;
    err.inUse = data.inUse;
    throw err;
  }
  return data;
}

export async function listSessions(): Promise<SessionRecord[]> {
  const { sessions } = await json(await presenterFetch('/api/sessions'));
  return sessions as SessionRecord[];
}

export async function fetchSession(id: string): Promise<SessionWithWarnings> {
  return json(await presenterFetch(`/api/sessions/${id}`));
}

/** Throws with `inUse` populated when the phone pool is exhausted (409). */
export async function createSession(title: string): Promise<SessionWithWarnings> {
  return json(
    await presenterFetch('/api/sessions', { method: 'POST', body: JSON.stringify({ title }) })
  );
}

export async function setStatus(id: string, status: 'draft' | 'live'): Promise<SessionRecord> {
  const { session } = await json(
    await presenterFetch(`/api/sessions/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  );
  return session as SessionRecord;
}

/** Ends the session and returns the snapshot — teardown is irreversible, so the
 *  export comes back with the same call that destroys the data. */
export async function endSession(id: string): Promise<{
  session: SessionRecord;
  snapshot: unknown;
  csv: string;
  filenames: { json: string; csv: string };
}> {
  return json(await presenterFetch(`/api/sessions/${id}/end`, { method: 'POST', body: '{}' }));
}

/** The session's own running order. Never `DEFAULT_DECK`. */
export function stagesFor(session: SessionRecord): ResolvedStage[] {
  return resolveDeck(session.deck);
}

/** Triggers a browser download without a server round trip. */
export function download(filename: string, contents: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
