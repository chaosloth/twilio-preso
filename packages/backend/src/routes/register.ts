import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { addParticipant, publishEvent, generateSyncToken } from '../services/sync.js';
import { sendWelcomeSms } from '../services/messaging.js';
import { requireLiveSession } from '../services/sessionContext.js';
import type { Participant, ParticipantJoinedEvent } from '@twilio-preso/shared';

interface RegisterBody {
  sessionId: string;
  name: string;
  phone: string;
  company?: string;
  role?: string;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RegisterBody }>(
    '/api/register',
    { preHandler: requireLiveSession },
    async (request, reply) => {
      const session = request.session!;
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

      await addParticipant(session.id, participant);

      const joinEvent: ParticipantJoinedEvent = {
        type: 'participant-joined',
        participantId: participant.id,
        name: participant.name,
        timestamp: Date.now(),
      };
      await publishEvent(session.id, joinEvent);

      // Sent from the session's own number, so the attendee's thread — and any
      // reply to it — belongs to this event and not a concurrent one.
      sendWelcomeSms(session.phoneNumber, participant).catch((err) => {
        app.log.warn({ err, sessionId: session.id }, 'failed to send welcome SMS');
      });

      const token = generateSyncToken(participant.id);

      return { participantId: participant.id, sessionId: session.id, token };
    }
  );
}
