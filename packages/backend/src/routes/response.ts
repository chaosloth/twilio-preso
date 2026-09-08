import type { FastifyInstance } from 'fastify';
import { publishEvent, recordParticipantResponse } from '../services/sync.js';
import { requireLiveSession } from '../services/sessionContext.js';
import { getParticipant } from '../services/sync.js';
import { recordObservation, responseObservation, writeResponseTrait } from '../services/memory.js';
import type { AudienceResponseEvent, InteractionType } from '@twilio-preso/shared';

interface ResponseBody {
  sessionId: string;
  participantId: string;
  participantName: string;
  /** Stage the answer belongs to. The key it is stored under. */
  stageId: string;
  /** Deck position it was answered at. Display ordering only. */
  stageIndex: number;
  interactionType: InteractionType;
  value: string;
}

export async function responseRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ResponseBody }>('/api/response', { preHandler: requireLiveSession }, async (request, reply) => {
    const sessionId = request.session!.id;
    const { participantId, participantName, stageId, stageIndex, interactionType, value } =
      request.body;

    if (!stageId) {
      return reply.status(400).send({ error: 'stageId required' });
    }

    const event: AudienceResponseEvent = {
      type: 'audience-response',
      participantId,
      participantName,
      stageId,
      stageIndex,
      interactionType,
      value,
      timestamp: Date.now(),
    };

    // Persist against the participant so later stages can personalize off it
    // (memory SMS, voice agent, AI-prompt agent). Best-effort: a write failure
    // must not lose the live tally.
    try {
      await recordParticipantResponse(sessionId, participantId, {
        stageId,
        stageIndex,
        type: interactionType,
        value,
        timestamp: event.timestamp,
      });
    } catch (err) {
      app.log.warn({ err, participantId, stageId }, 'failed to persist participant response');
    }

    // Mirror the answer into the attendee's durable Customer Profile. Sync is
    // still the source of truth for this session; memory is what survives it.
    // Not awaited, and swallowed on failure — the tally must not wait on it.
    void (async () => {
      const participant = await getParticipant(sessionId, participantId);
      if (!participant?.memoryProfileId) return;
      // A mandatory poll answer is one of a fixed set of options, so it is a
      // trait too — the durable "this attendee builds for TwilioTours in green"
      // a later session can read back directly instead of searching prose.
      await writeResponseTrait(participant.memoryProfileId, stageId, value);
      // Still an observation as well: free-text answers have no schema, and only
      // observations are semantically indexed for recall.
      await recordObservation(
        participant.memoryProfileId,
        responseObservation(participant, {
          stageId,
          stageIndex,
          type: interactionType,
          value,
          timestamp: event.timestamp,
        })
      );
    })().catch((err) => {
      app.log.warn({ err, participantId, stageId }, 'failed to write response to memory');
    });

    await publishEvent(sessionId, event);
    return { ok: true };
  });
}
