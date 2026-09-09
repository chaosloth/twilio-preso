import type { FastifyInstance } from 'fastify';
import { createLlmClientFromEnv, llmConfigFromEnv } from '@twilio-preso/llm';
import type { LlmClient } from '@twilio-preso/llm';
import {
  buildCallerContext,
  resolveRelayConfig,
  systemPromptFor,
  tallyRoom,
} from '@twilio-preso/shared';
import type { Participant, SessionRecord } from '@twilio-preso/shared';
import { config } from '../config.js';
import { requirePresenter } from '../services/auth.js';
import { sendTextOnChannel } from '../services/messaging.js';
import { recall } from '../services/memory.js';
import {
  describeOrchestrator,
  ensureConfiguration,
  listCommunications,
} from '../services/orchestrator.js';
import { historyFromCommunications, inboundText } from '../services/orchestratorEvents.js';
import type { InboundText, OrchestratorEvent } from '../services/orchestratorEvents.js';
import { getSessionById, sessionIdForPhoneNumber } from '../services/sessions.js';
import { getAllParticipants, isSessionLive } from '../services/sync.js';
import {
  isSignatureBypassed,
  requireOrchestratorSignature,
  setSignatureBypass,
} from '../services/twilioSignature.js';

/**
 * The text half of the AI agent.
 *
 * Same persona, same caller context, same room result as the voice agent — they
 * share `systemPromptFor` in `@twilio-preso/shared` and the per-session
 * `session.relay` the HUD's voice tab edits. The medium is the only difference:
 * `medium: 'text'` writes for a screen and offers no tool sentinels.
 *
 * Conversation Orchestrator's callback is a post-event notification, not a
 * request whose response is delivered, so the reply is sent over the Messages API
 * rather than returned. Which is also why the route answers `200` even when it
 * declines: a non-2xx invites redelivery, and a redelivered turn is a duplicate
 * reply to a real person.
 */

/** Model clients cached per model, so a per-session override does not rebuild an
 *  SDK client on every message. */
const clients = new Map<string, LlmClient>();

function llmFor(model: string): LlmClient {
  const resolved = model || llmConfigFromEnv(process.env).model;
  let client = clients.get(resolved);
  if (!client) {
    client = model ? createLlmClientFromEnv({ ...process.env, LLM_MODEL: model }) : createLlmClientFromEnv();
    clients.set(resolved, client);
  }
  return client;
}

const STUMBLE = "Sorry — I lost my train of thought there. Ask me again?";

function findParticipant(participants: Participant[], phone: string): Participant | null {
  const wanted = phone.replace(/[^\d+]/g, '');
  return participants.find((p) => p.phone.replace(/[^\d+]/g, '') === wanted) ?? null;
}

/**
 * Answers one message.
 *
 * Everything it needs is derived from the number that was written to, the same
 * way the voice agent derives a session from the number that was called — so a
 * text into any live session's number reaches that session's agent with no
 * per-session wiring.
 */
async function reply(app: FastifyInstance, message: InboundText): Promise<void> {
  const sessionId = await sessionIdForPhoneNumber(message.poolNumber);
  if (!sessionId) {
    app.log.warn({ poolNumber: message.poolNumber }, 'orchestrator: no session claims this number');
    return;
  }
  const session: SessionRecord | null = await getSessionById(sessionId);
  if (!session || session.status !== 'live') {
    app.log.info({ sessionId }, 'orchestrator: session is not live, not replying');
    return;
  }

  /**
   * The same carve-out `/api/voice/test-call` has: the presenter texting their own
   * session in rehearsal is how the agent gets heard before an audience hears it,
   * while every other number stays behind `isLive` so this cannot become the one
   * route that messages a room from an unarmed session.
   */
  if (!(await isSessionLive(sessionId)) && message.from !== session.ownerPhone) {
    app.log.info({ sessionId }, 'orchestrator: session is in rehearsal, not replying');
    return;
  }

  const relayConfig = resolveRelayConfig(session.relay);
  const participants = await getAllParticipants(sessionId);
  const participant = findParticipant(participants, message.from);

  // Read once, before the turn — a memory round trip per message is latency a
  // person watching a typing thread notices.
  let recalled: string | null = null;
  if (relayConfig.useMemory && participant?.memoryProfileId) {
    try {
      recalled = await recall(participant.memoryProfileId, message.text);
    } catch (err) {
      app.log.warn({ err }, 'orchestrator: memory recall failed');
    }
  }

  const ctx = {
    ...buildCallerContext(participant, null, true, tallyRoom(participants)),
    recall: recalled,
  };

  const history = message.conversationId
    ? historyFromCommunications(
        await listCommunications(message.conversationId).catch((err) => {
          app.log.warn({ err }, 'orchestrator: could not read the thread, answering without history');
          return [];
        }),
        message.poolNumber
      )
    : [];

  /**
   * The thread is capped by the session's own inbound turn limit — the setting
   * that already says how long this agent should talk — counted from the replies
   * in the conversation itself, so no second store is needed and a restart does
   * not reset it.
   */
  const sent = history.filter((h) => h.role === 'assistant').length;
  if (sent >= relayConfig.maxTurnsInbound) {
    app.log.info({ sessionId, sent }, 'orchestrator: turn limit reached, not replying');
    return;
  }

  // History includes the message being answered (it is already a Communication),
  // so the last user turn is dropped rather than sent twice.
  const priorTurns = history.at(-1)?.content === message.text ? history.slice(0, -1) : history;

  let body: string;
  try {
    const text = await llmFor(relayConfig.model).complete({
      system: systemPromptFor(ctx, relayConfig, { medium: 'text' }),
      maxTokens: 200,
      messages: [...priorTurns, { role: 'user' as const, content: message.text }],
    });
    body = text?.trim() || STUMBLE;
  } catch (err) {
    // A failed turn is a message that never arrives, which reads as the agent
    // ignoring them. Say something instead.
    app.log.error({ err }, 'orchestrator: LLM turn failed');
    body = STUMBLE;
  }

  const via = await sendTextOnChannel(message.channel, session.phoneNumber, message.from, body);
  app.log.info({ sessionId, via, to: message.from }, 'orchestrator: replied');
}

export async function orchestratorRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Keeps the raw bytes of the body, which the signature is taken over: the hash
   * is of what Twilio sent, and re-serializing the parsed object changes key
   * order and whitespace. Scoped to this plugin, so no other route's parsing
   * changes.
   */
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    (request as typeof request & { rawBody?: string }).rawBody = body as string;
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  /**
   * Conversation Orchestrator's status callback.
   *
   * Twilio signs it the same way it signs a TwiML webhook, except over the JSON
   * body's hash rather than form fields — so the account auth token is what
   * authenticates it, and this endpoint (which runs an LLM turn and sends a real
   * message) needs no shared secret of its own.
   */
  app.post<{ Body: OrchestratorEvent }>(
    '/api/orchestrator/webhook',
    { preHandler: requireOrchestratorSignature },
    async (request) => {
      const message = inboundText(request.body, config.twilio.phonePool);
      // 200 either way. A retried delivery of a message already answered is a
      // second reply to a real phone, so nothing here asks Twilio to try again.
      if (!message) return { ignored: true };

      try {
        await reply(app, message);
      } catch (err) {
        request.log.error({ err }, 'orchestrator: reply failed');
      }
      return { ok: true };
    }
  );

  /** Creates or updates the account's Orchestrator configuration. Presenter-only
   *  and manual: it writes account-level config that outlives the event. */
  app.post('/api/orchestrator/configuration', { preHandler: requirePresenter }, async (_req, reply_) => {
    try {
      return await ensureConfiguration();
    } catch (err: any) {
      return reply_.status(409).send({ error: String(err?.message ?? err) });
    }
  });

  app.get('/api/orchestrator/configuration', { preHandler: requirePresenter }, async () =>
    describeOrchestrator()
  );

  /**
   * Toggles signature validation on the webhook above. Presenter-only, and a
   * toggle rather than a switch that stays where it is put: it is held in memory,
   * so a restart or a deploy closes an open webhook that somebody forgot.
   *
   * It exists because a rejected callback looks exactly like a broken agent — the
   * text arrives, nothing answers, and the only evidence is a 403 in the log —
   * and behind a tunnel the signed origin and the origin serving the request are
   * easy to get apart.
   */
  app.post('/api/orchestrator/signature-bypass', { preHandler: requirePresenter }, async (req) => {
    const bypassed = setSignatureBypass(!isSignatureBypassed());
    req.log.warn({ bypassed }, 'orchestrator signature validation toggled');
    return { bypassed };
  });
}
