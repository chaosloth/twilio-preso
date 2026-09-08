import { resolveDeck } from '@twilio-preso/shared';
import type {
  Deck,
  DeckWarning,
  PhonePoolUsage,
  Presenter,
  RelayConfig,
  ResolvedStage,
  SessionRecord,
} from '@twilio-preso/shared';
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

/**
 * Save a reordered/edited deck. The warnings come back with the saved record
 * rather than blocking the write — a deck whose dependency order is off is the
 * presenter's call to make, surfaced in the HUD.
 */
export async function saveDeck(id: string, deck: Deck): Promise<SessionWithWarnings> {
  return json(
    await presenterFetch(`/api/sessions/${id}/deck`, {
      method: 'PUT',
      body: JSON.stringify({ deck }),
    })
  );
}

/**
 * The session's voice-agent settings, resolved: defaults merged in, so the HUD
 * edits real values rather than blanks and never has to know which fields the
 * record happens to carry.
 */
export async function fetchRelayConfig(id: string): Promise<RelayConfig> {
  const { relay } = await json(await presenterFetch(`/api/sessions/${id}/relay`));
  return relay as RelayConfig;
}

export async function saveRelayConfig(id: string, relay: RelayConfig): Promise<RelayConfig> {
  const result = await json(
    await presenterFetch(`/api/sessions/${id}/relay`, {
      method: 'PUT',
      body: JSON.stringify({ relay }),
    })
  );
  return result.relay as RelayConfig;
}

/** Places one real call into the agent, so the settings above can be heard
 *  before an audience hears them. Own number in rehearsal, anyone once armed. */
export async function placeTestCall(
  sessionId: string,
  to?: string
): Promise<{ callSid: string; to: string; from: string }> {
  return json(
    await presenterFetch('/api/voice/test-call', {
      method: 'POST',
      body: JSON.stringify({ sessionId, to: to || undefined }),
    })
  );
}

export async function listPresenters(): Promise<Presenter[]> {
  const { presenters } = await json(await presenterFetch('/api/presenters'));
  return presenters as Presenter[];
}

export async function addPresenter(phone: string, name: string): Promise<Presenter> {
  const { presenter } = await json(
    await presenterFetch('/api/presenters', {
      method: 'POST',
      body: JSON.stringify({ phone, name }),
    })
  );
  return presenter as Presenter;
}

/** The backend refuses to remove the caller's own entry, so a lockout is unreachable. */
export async function removePresenter(phone: string): Promise<void> {
  await json(
    await presenterFetch(`/api/presenters/${encodeURIComponent(phone)}`, { method: 'DELETE' })
  );
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
