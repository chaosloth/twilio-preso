import type { FastifyInstance } from 'fastify';
import { publishEvent, recordParticipantResponse } from '../services/sync.js';
import type { AudienceResponseEvent, InteractionType } from '@twilio-preso/shared';

interface ResponseBody {
  participantId: string;
  participantName: string;
  stageIndex: number;
  interactionType: InteractionType;
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

    // Persist against the participant so later stages can personalize off it
    // (memory SMS, voice agent, AI-prompt agent). Best-effort: a write failure
    // must not lose the live tally.
    try {
      await recordParticipantResponse(participantId, {
        stageIndex,
        type: interactionType,
        value,
        timestamp: event.timestamp,
      });
    } catch (err) {
      app.log.warn({ err, participantId, stageIndex }, 'failed to persist participant response');
    }

    await publishEvent(event);
    return { ok: true };
  });
}
