import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { addParticipant, publishEvent, generateSyncToken } from '../services/sync.js';
import { sendWelcomeSms } from '../services/messaging.js';
import type { Participant, ParticipantJoinedEvent } from '@twilio-preso/shared';

interface RegisterBody {
  name: string;
  phone: string;
  company?: string;
  role?: string;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RegisterBody }>('/api/register', async (request, reply) => {
    const { name, phone, company, role } = request.body;

    if (!name || !phone) {
      return reply.status(400).send({ error: 'name and phone are required' });
    }

    const participant: Participant = {
      id: randomUUID(),
      name,
      phone,
      company,
      role,
      registeredAt: Date.now(),
      responses: {},
    };

    await addParticipant(participant);

    const joinEvent: ParticipantJoinedEvent = {
      type: 'participant-joined',
      participantId: participant.id,
      name: participant.name,
      timestamp: Date.now(),
    };
    await publishEvent(joinEvent);

    sendWelcomeSms(participant).catch((err) => {
      console.error('Failed to send welcome SMS:', err.message);
    });

    const token = generateSyncToken(participant.id);

    return { participantId: participant.id, token };
  });
}
