import type { FastifyInstance } from 'fastify';
import { getParticipant, publishEvent } from '../services/sync.js';
import { streamAiResponse } from '../services/ai.js';
import { requireLiveSession, stagesFor } from '../services/sessionContext.js';
import { askedObservation, recordObservation } from '../services/memory.js';
import type { AiPromptPendingEvent, AiPromptResponseEvent } from '@twilio-preso/shared';

interface AiPromptBody {
  sessionId: string;
  participantId: string;
  participantName: string;
  stageId: string;
  stageIndex: number;
  prompt: string;
}

const FALLBACK = "Hmm, I didn't quite catch that — try asking again!";

/**
 * Shown when the model itself could not be reached — an expired key, a model
 * this account cannot use, an exhausted credit balance. Deliberately distinct
 * from FALLBACK: that one invites a retry, and this is the case where retrying
 * cannot help. The provider's own message goes to the log, never to a phone or
 * the big screen.
 */
const UNAVAILABLE = 'The AI agent is offline right now — the presenter has been told.';

export async function aiPromptRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Streams the answer back to the asking phone as SSE so it can render word by
   * word. The presenter screen still receives one `ai-prompt-response` Sync
   * event, published once the full text is assembled.
   */
  app.post<{ Body: AiPromptBody }>('/api/ai-prompt', { preHandler: requireLiveSession }, async (request, reply) => {
    const session = request.session!;
    const { participantId, participantName, stageId, stageIndex } = request.body;
    const prompt = request.body.prompt?.trim();

    if (!prompt) {
      return reply.status(400).send({ error: 'prompt required' });
    }

    // Their earlier poll/text answers get folded into the agent's context.
    // A lookup failure just means a less personal answer — never a failed ask.
    const participant = await getParticipant(session.id, participantId).catch((err) => {
      app.log.warn({ err, participantId }, 'ai-prompt: participant lookup failed');
      return null;
    });

    // Put the question on the big screen straight away, so the room sees it
    // (with a thinking animation) while the model works. Fire-and-forget: the
    // phone should not wait on Sync.
    const pending: AiPromptPendingEvent = {
      type: 'ai-prompt-pending',
      participantId,
      participantName,
      stageId,
      stageIndex,
      prompt,
      timestamp: Date.now(),
    };
    publishEvent(session.id, pending).catch((err) =>
      app.log.error({ err }, 'failed to publish ai-prompt-pending')
    );

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Vite's dev proxy and most CDNs buffer without this.
      'X-Accel-Buffering': 'no',
      // We write straight to the raw socket, so @fastify/cors' reply hooks
      // never run — mirror its `origin: true` behaviour by reflecting the
      // request origin here, or the browser blocks the streamed response.
      'Access-Control-Allow-Origin': request.headers.origin || '*',
      Vary: 'Origin',
    });

    const send = (data: unknown) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);

    let full = '';
    let failed = false;
    try {
      for await (const delta of streamAiResponse(prompt, stagesFor(session), participantName, participant)) {
        full += delta;
        send({ type: 'delta', text: delta });
      }
    } catch (err) {
      app.log.error({ err }, 'ai-prompt stream failed');
      failed = true;
      // Carry a message the phone can actually render. Without one the audience
      // sees a generic "something went wrong" and the only way to tell an outage
      // from a typo is to read the server log — which nobody does mid-talk.
      send({ type: 'error', message: UNAVAILABLE });
    }

    const response = failed ? UNAVAILABLE : full.trim() || FALLBACK;
    if (!failed) send({ type: 'done', response });
    reply.raw.end();

    const event: AiPromptResponseEvent = {
      type: 'ai-prompt-response',
      participantId,
      participantName,
      stageId,
      stageIndex,
      prompt,
      response,
      timestamp: Date.now(),
    };

    /**
     * The question itself belongs in the attendee's durable profile.
     *
     * What someone chose to ask is the strongest signal this talk collects — the
     * voice agent recalling it later in the same hour is the memory demo — and
     * it is stored as an *observation* rather than a trait because a free-text
     * question has no schema and only observations are semantically indexed for
     * recall. Written whether or not the model answered: an outage should not
     * lose what the room wanted to know. Best-effort, like every memory write on
     * a request path — the phone already has its answer by now.
     */
    if (participant?.memoryProfileId) {
      void recordObservation(
        participant.memoryProfileId,
        askedObservation(participant.name || participantName, prompt)
      ).catch((err) => app.log.warn({ err, participantId }, 'failed to record the question in memory'));
    }

    // Broadcast to the presenter screen after the phone has its answer — on
    // failure too, so the slide stops thinking and the room is not left watching
    // a spinner for a question that will never be answered.
    try {
      await publishEvent(session.id, event);
    } catch (err) {
      app.log.error({ err }, 'failed to publish ai-prompt-response');
    }

    return reply;
  });
}
