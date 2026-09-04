import type { PublicSession } from '@twilio-preso/shared';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

/** localStorage prefix. Namespaced per session so a phone that attended two
 *  events does not resume the wrong one — or, worse, register under one session
 *  and then publish responses with the other's participant id. */
const KEY_PREFIX = 'wonder-session:';

export interface JoinedSession extends PublicSession {
  joinCode: string;
}

export interface StoredSession extends JoinedSession {
  participantId: string;
  name: string;
}

export function saveSession(stored: StoredSession): void {
  localStorage.setItem(KEY_PREFIX + stored.sessionId, JSON.stringify(stored));
}

export function loadSession(sessionId: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + sessionId);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function forgetSession(sessionId: string): void {
  localStorage.removeItem(KEY_PREFIX + sessionId);
}

/** Every session this device has registered for, newest key order not implied. */
export function listSavedSessions(): StoredSession[] {
  const out: StoredSession[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith(KEY_PREFIX)) continue;
    try {
      out.push(JSON.parse(localStorage.getItem(key)!) as StoredSession);
    } catch {
      // A corrupt entry is not worth a broken join screen.
    }
  }
  return out;
}

/** `/j/CODE` — the QR deep link. Returns null for any other path. */
export function joinCodeFromPath(pathname: string): string | null {
  const match = /^\/j\/([^/]+)\/?$/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

export type ResolveResult =
  | { ok: true; session: JoinedSession }
  | { ok: false; error: string };

/**
 * Resolves a typed or scanned code against the one public session endpoint.
 * The code is sent as given — normalisation (including folding I/L/O/U onto the
 * characters they resemble) happens server-side, so there is one implementation
 * of it rather than two that can drift.
 */
export async function resolveJoinCode(code: string): Promise<ResolveResult> {
  const joinCode = code.trim().toUpperCase();
  if (!joinCode) return { ok: false, error: 'Enter the code from the screen' };

  try {
    const res = await fetch(`${BACKEND_URL}/api/session/${encodeURIComponent(joinCode)}`);
    if (res.status === 429) {
      return { ok: false, error: 'Too many tries — wait a moment and try again' };
    }
    if (!res.ok) return { ok: false, error: "That code doesn't look right" };
    const session = (await res.json()) as PublicSession;
    return { ok: true, session: { ...session, joinCode } };
  } catch {
    return { ok: false, error: 'Network problem — check your signal and retry' };
  }
}
