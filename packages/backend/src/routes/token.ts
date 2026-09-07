import type { FastifyInstance } from 'fastify';
import { generateSyncToken, getParticipant } from '../services/sync.js';
import { getSessionById } from '../services/sessions.js';
import { attachPresenter } from '../services/auth.js';

interface TokenQuery {
  identity: string;
  sessionId: string;
}

export async function tokenRoutes(app: FastifyInstance): Promise<void> {
  /**
   * A Sync token is what lets a client read presentation state and the roster, so
   * it is issued only to a presenter or to someone already registered for *this*
   * session. Previously any identity that asked got one.
   *
   * Deliberately not gated on `status === 'live'`: a presenter needs a token while
   * the session is still `draft` to drive the screen during rehearsal.
   */
  app.get<{ Querystring: TokenQuery }>(
    '/api/token',
    { preHandler: attachPresenter },
    async (request, reply) => {
      const { identity, sessionId } = request.query;
      if (!identity || !sessionId) {
        return reply.status(400).send({ error: 'identity and sessionId query params required' });
      }

      const session = await getSessionById(sessionId);
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      if (!request.presenter && !(await getParticipant(sessionId, identity))) {
        return reply.status(403).send({ error: 'Not a participant of this session' });
      }

      const token = generateSyncToken(identity);
      return { token, identity, sessionId };
    }
  );
}
