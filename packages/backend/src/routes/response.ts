import type { FastifyInstance } from 'fastify';
import { publishEvent } from '../services/sync.js';
import type { AudienceResponseEvent } from '@twilio-preso/shared';

interface ResponseBody {
  participantId: string;
  participantName: string;
  stageIndex: number;
  interactionType: string;
  value: string;
}

export async function responseRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ResponseBody }>('/api/response', async (request) => {
    const { participantId, participantName, stageIndex, interactionType, value } = request.body;

    const event: AudienceResponseEvent = {
      type: 'audience-response',
      participantId,
      participantName,
      stageIndex,
      interactionType,
      value,
      timestamp: Date.now(),
    };

    await publishEvent(event);
    return { ok: true };
  });
}
