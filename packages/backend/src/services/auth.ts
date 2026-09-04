import jwt from 'jsonwebtoken';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { getPresenter } from './sessions.js';

/** Long enough to cover a rehearsal plus the event without a re-login on stage. */
const TOKEN_TTL_SECONDS = 12 * 60 * 60;

export interface PresenterIdentity {
  phone: string;
  name: string;
}

interface PresenterClaims {
  sub: string;
  name: string;
}

export function signPresenterToken(identity: PresenterIdentity): string {
  return jwt.sign({ sub: identity.phone, name: identity.name }, config.presenterJwtSecret, {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

/** Verifies signature and expiry. Says nothing about the allowlist. */
export function verifyPresenterToken(token: string): PresenterIdentity | null {
  try {
    const claims = jwt.verify(token, config.presenterJwtSecret, {
      algorithms: ['HS256'],
    }) as PresenterClaims;
    if (!claims.sub) return null;
    return { phone: claims.sub, name: claims.name };
  } catch {
    return null;
  }
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme?.toLowerCase() !== 'bearer') return null;
  return token;
}

/**
 * Fastify `preHandler` gating every presenter route. Two checks, not one: a
 * valid token, **and** `sub` still present in `presenter-allowlist`. The second
 * is what makes removing someone take effect immediately rather than whenever
 * their 12-hour token happens to expire.
 */
export async function requirePresenter(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = bearerToken(request);
  const identity = token ? verifyPresenterToken(token) : null;

  if (!identity) {
    return reply.status(401).send({ error: 'Presenter authentication required' });
  }

  const presenter = await getPresenter(identity.phone);
  if (!presenter) {
    return reply.status(403).send({ error: 'No longer authorised' });
  }

  // Name comes from the allowlist, not the token: a rename in the HUD applies
  // without waiting for the holder to sign in again.
  request.presenter = { phone: presenter.phone, name: presenter.name };
}

declare module 'fastify' {
  interface FastifyRequest {
    presenter?: PresenterIdentity;
  }
}
