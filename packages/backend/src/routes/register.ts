import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import {
  addParticipant,
  publishEvent,
  generateSyncToken,
  isSessionLive,
  updateParticipant,
} from '../services/sync.js';
import { upsertProfile } from '../services/memory.js';
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
      // reply to it — belongs to this event and not a concurrent one. Gated on
      // `isLive` like every other outbound: rehearsing with a few colleagues'
      // real phones should not text them, and registration is the one outbound
      // path an audience can trigger without the presenter touching anything.
      if (await isSessionLive(session.id)) {
        sendWelcomeSms(session.phoneNumber, participant).catch((err) => {
          app.log.warn({ err, sessionId: session.id }, 'failed to send welcome SMS');
        });
      }

      // Conversation Memory profile: looked up by phone so a returning attendee
      // keeps the profile they already have, created otherwise. Fired after the
      // participant exists and deliberately not awaited — the phone must get its
      // token immediately, and a memory outage cannot be allowed to fail a join.
      void upsertProfile(participant)
        .then(async (memoryProfileId) => {
          if (memoryProfileId) {
            await updateParticipant(session.id, participant.id, { memoryProfileId });
          }
        })
        .catch((err) => {
          app.log.warn({ err, sessionId: session.id }, 'failed to create memory profile');
        });

      const token = generateSyncToken(participant.id);

      return { participantId: participant.id, sessionId: session.id, token };
    }
  );
}
