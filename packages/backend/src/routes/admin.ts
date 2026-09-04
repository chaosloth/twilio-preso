import type { FastifyInstance } from 'fastify';
import { getAllParticipants } from '../services/sync.js';
import Twilio from 'twilio';
import { config } from '../config.js';
import { requirePresenter } from '../services/auth.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);
const syncService = client.sync.v1.services(config.twilio.syncServiceSid);

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Every route here is presenter-only: they expose attendee names and phone
  // numbers, toggle the isLive gate on all outbound Twilio traffic, and destroy
  // participant data.
  app.addHook('preHandler', requirePresenter);

  // List all participants
  app.get('/api/admin/participants', async () => {
    const participants = await getAllParticipants();
    return { participants, count: participants.length };
  });

  // Remove a single participant
  app.delete<{ Params: { id: string } }>('/api/admin/participants/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      await syncService.syncMaps('participants').syncMapItems(id).remove();
      return { removed: id };
    } catch {
      return reply.status(404).send({ error: 'Participant not found' });
    }
  });

  // Get presentation mode (live/rehearsal)
  app.get('/api/admin/mode', async () => {
    try {
      const doc = await syncService.documents('presentation-state').fetch();
      return { isLive: doc.data.isLive ?? true };
    } catch {
      return { isLive: true };
    }
  });

  // Toggle presentation mode
  app.post('/api/admin/mode', async (request) => {
    const { isLive } = request.body as { isLive: boolean };
    const doc = await syncService.documents('presentation-state').fetch();
    await syncService.documents('presentation-state').update({
      data: { ...doc.data, isLive },
    });
    return { isLive };
  });

  // Reset all participants
  app.post('/api/admin/reset', async () => {
    try {
      await syncService.syncMaps('participants').remove();
      await syncService.syncMaps.create({ uniqueName: 'participants' });

      // Reset presentation state doc
      await syncService.documents('presentation-state').update({
        data: { currentStageIndex: 0, activeInteraction: null, totalParticipants: 0, isLive: true },
      });

      // Reset aggregate results
      await syncService.documents('aggregate-results').update({
        data: { stageId: '', stageIndex: 0, type: 'poll', results: {}, totalResponses: 0 },
      });

      return { reset: true };
    } catch (err: any) {
      return { reset: false, error: err.message };
    }
  });
}
