/**
 * Presenter auth. A 12-hour JWT from `POST /api/auth/verify`, kept in
 * localStorage so a reload mid-presentation does not put a login form on the
 * big screen.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const TOKEN_KEY = 'wonder-presenter-token';

export interface PresenterIdentity {
  phone: string;
  name: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch with the presenter bearer token attached. A 401/403 means the token
 * expired or the presenter was removed from the allowlist — the caller decides
 * whether that means "show the login gate" or just "this action failed".
 */
export async function presenterFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

/** Whether the stored token is still both valid and allowlisted. */
export async function whoAmI(): Promise<PresenterIdentity | null> {
  if (!getToken()) return null;
  try {
    const res = await presenterFetch('/api/auth/me');
    if (!res.ok) return null;
    return (await res.json()) as PresenterIdentity;
  } catch {
    return null;
  }
}

async function post(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** Sends the OTP. Always reports success — the backend deliberately does not
 *  reveal whether a number is allowlisted. */
export async function startLogin(phone: string): Promise<void> {
  await post('/api/auth/start', { phone });
}

export async function completeLogin(phone: string, code: string): Promise<PresenterIdentity> {
  const data = await post('/api/auth/verify', { phone, code });
  setToken(data.token);
  return { phone: data.phone, name: data.name };
}
