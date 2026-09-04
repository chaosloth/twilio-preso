import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ResolvedStage, SessionRecord } from '@twilio-preso/shared';
import { resolveDeck } from '@twilio-preso/shared';
import { getSessionById } from './sessions.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `requireLiveSession`. Present only on session-scoped routes. */
    session?: SessionRecord;
  }
}

function sessionIdFrom(request: FastifyRequest): string | null {
  const body = request.body as { sessionId?: unknown } | undefined;
  const query = request.query as { sessionId?: unknown } | undefined;
  const candidate = body?.sessionId ?? query?.sessionId;
  return typeof candidate === 'string' && candidate ? candidate : null;
}

/**
 * Fastify `preHandler` for every session-scoped route. Resolves `sessionId` from
 * the body or query string, loads the record, and attaches it to the request so
 * handlers never re-fetch or trust a client-supplied deck.
 *
 * Rejecting anything that is not `live` is deliberate and does double duty: it
 * stops one event's phones from answering another's prompts, and it stops
 * registrations and responses trickling in against a session that has ended —
 * whose Sync objects are already gone, so the writes would fail anyway, just
 * later and less legibly.
 *
 * A `draft` session is rejected too. Rehearsal is `status: 'live'` with the
 * `isLive` Sync flag off: the deck runs, no real phone is texted or called.
 */
export async function requireLiveSession(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sessionId = sessionIdFrom(request);
  if (!sessionId) {
    return reply.status(400).send({ error: 'sessionId required' });
  }

  const session = await getSessionById(sessionId);
  if (!session) {
    return reply.status(404).send({ error: 'Session not found' });
  }

  if (session.status !== 'live') {
    return reply
      .status(409)
      .send({ error: `Session is ${session.status}`, status: session.status });
  }

  request.session = session;
}

/** The session's own running order — never `DEFAULT_DECK`. */
export function stagesFor(session: SessionRecord): ResolvedStage[] {
  return resolveDeck(session.deck);
}
