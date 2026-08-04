import type { FastifyInstance } from 'fastify';
import { getParticipant, publishEvent } from '../services/sync.js';
import { streamAiResponse } from '../services/ai.js';
import type { AiPromptPendingEvent, AiPromptResponseEvent } from '@twilio-preso/shared';

interface AiPromptBody {
  participantId: string;
  participantName: string;
  stageIndex: number;
  prompt: string;
}

const FALLBACK = "Hmm, I didn't quite catch that — try asking again!";

export async function aiPromptRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Streams the answer back to the asking phone as SSE so it can render word by
   * word. The presenter screen still receives one `ai-prompt-response` Sync
   * event, published once the full text is assembled.
   */
  app.post<{ Body: AiPromptBody }>('/api/ai-prompt', async (request, reply) => {
    const { participantId, participantName, stageIndex } = request.body;
    const prompt = request.body.prompt?.trim();

    if (!prompt) {
      return reply.status(400).send({ error: 'prompt required' });
    }

    // Their earlier poll/text answers get folded into the agent's context.
    // A lookup failure just means a less personal answer — never a failed ask.
    const participant = await getParticipant(participantId).catch((err) => {
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
      stageIndex,
      prompt,
      timestamp: Date.now(),
    };
    publishEvent(pending).catch((err) =>
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
      for await (const delta of streamAiResponse(prompt, participantName, participant)) {
        full += delta;
        send({ type: 'delta', text: delta });
      }
    } catch (err) {
      app.log.error({ err }, 'ai-prompt stream failed');
      failed = true;
      send({ type: 'error' });
    }

    const response = full.trim() || FALLBACK;
    if (!failed) send({ type: 'done', response });
    reply.raw.end();

    const event: AiPromptResponseEvent = {
      type: 'ai-prompt-response',
      participantId,
      participantName,
      stageIndex,
      prompt,
      response,
      timestamp: Date.now(),
    };

    // Broadcast to the presenter screen after the phone has its answer.
    try {
      await publishEvent(event);
    } catch (err) {
      app.log.error({ err }, 'failed to publish ai-prompt-response');
    }

    return reply;
  });
}
