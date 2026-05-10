import type { FastifyInstance } from 'fastify';
import { lookupPhone, startVerification, checkVerification } from '../services/verify.js';

interface StartBody { phone: string; }
interface CheckBody { phone: string; code: string; }

export async function verifyRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: StartBody }>('/api/verify/start', async (request, reply) => {
    const { phone } = request.body;
    if (!phone) return reply.status(400).send({ error: 'phone is required' });

    const lookup = await lookupPhone(phone);
    if (!lookup.valid) {
      return reply.status(400).send({ error: 'Invalid phone number. Please include country code (e.g. +61...)' });
    }

    await startVerification(lookup.formatted);
    return { formatted: lookup.formatted };
  });

  app.post<{ Body: CheckBody }>('/api/verify/check', async (request, reply) => {
    const { phone, code } = request.body;
    if (!phone || !code) return reply.status(400).send({ error: 'phone and code are required' });

    const approved = await checkVerification(phone, code);
    if (!approved) {
      return reply.status(400).send({ error: 'Invalid or expired code. Try again.' });
    }

    return { verified: true };
  });
}
