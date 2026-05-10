import type { FastifyInstance } from 'fastify';
import { generateSyncToken } from '../services/sync.js';

interface TokenQuery {
  identity: string;
}

export async function tokenRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: TokenQuery }>('/api/token', async (request, reply) => {
    const { identity } = request.query;
    if (!identity) {
      return reply.status(400).send({ error: 'identity query param required' });
    }
    const token = generateSyncToken(identity);
    return { token, identity };
  });
}
