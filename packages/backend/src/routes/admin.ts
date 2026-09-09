import type { FastifyInstance } from 'fastify';
import {
  getAllParticipants,
  getPresentationState,
  removeParticipant,
  publishEvent,
  resetParticipants,
  updatePresentationState,
} from '../services/sync.js';
import { requirePresenter } from '../services/auth.js';
import { requireLiveSession } from '../services/sessionContext.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Every route here is presenter-only and session-scoped: they expose attendee
  // names and phone numbers, toggle the isLive gate on all outbound Twilio
  // traffic, and destroy participant data — always for exactly one session. The
  // raw Sync client is gone; object names now come only from `syncNames`.
  app.addHook('preHandler', requirePresenter);
  app.addHook('preHandler', requireLiveSession);

  app.get<{ Querystring: { sessionId: string } }>('/api/admin/participants', async (request) => {
    const participants = await getAllParticipants(request.session!.id);
    return { participants, count: participants.length };
  });

  app.delete<{ Params: { id: string }; Querystring: { sessionId: string } }>(
    '/api/admin/participants/:id',
    async (request, reply) => {
      const removed = await removeParticipant(request.session!.id, request.params.id);
      if (!removed) {
        return reply.status(404).send({ error: 'Participant not found' });
      }
      // Tell the phone itself. Its Sync token is still valid, so nothing else
      // would: it would sit on the current slide until that token expired,
      // connected to a session it is no longer part of.
      await publishEvent(request.session!.id, {
        type: 'participant-removed',
        participantId: request.params.id,
        timestamp: Date.now(),
      });
      return { removed: request.params.id };
    }
  );

  /**
   * The rehearsal gate. Reported as `false` when the state document cannot be
   * read: defaulting to live on an error would arm SMS and voice calls to real
   * phones off the back of a failed fetch.
   */
  app.get<{ Querystring: { sessionId: string } }>('/api/admin/mode', async (request) => {
    const state = await getPresentationState(request.session!.id);
    return { isLive: state?.isLive ?? false };
  });

  app.post<{ Body: { sessionId: string; isLive: boolean } }>('/api/admin/mode', async (request) => {
    const { isLive } = request.body;
    await updatePresentationState(request.session!.id, { isLive });
    return { isLive };
  });

  /**
   * Clears one session's roster, stage position, and tallies. `isLive` is
   * deliberately left as it was — a reset between rehearsal runs should not
   * silently arm outbound traffic.
   */
  app.post<{ Body: { sessionId: string } }>('/api/admin/reset', async (request, reply) => {
    try {
      await resetParticipants(request.session!.id);
      // Empty id: every phone in the room is no longer a participant.
      await publishEvent(request.session!.id, {
        type: 'participant-removed',
        participantId: '',
        timestamp: Date.now(),
      });
      return { reset: true };
    } catch (err: any) {
      request.log.error({ err, sessionId: request.session!.id }, 'admin reset failed');
      return reply.status(500).send({ reset: false, error: err.message });
    }
  });
}
