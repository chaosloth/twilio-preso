import type { FastifyInstance } from 'fastify';
import Twilio from 'twilio';
import { config } from '../config.js';
import { getAllParticipants, getParticipant, isSessionLive } from '../services/sync.js';
import { sendToAllOnChannel } from '../services/messaging.js';
import type { MessageChannel } from '../services/messaging.js';
import { initiateAgentCall } from '../services/voice.js';
import {
  enabledRelayTools,
  resolveRelayConfig,
  resolvedLanguages,
  responseFor,
  sayVoice,
  supportsAutoLanguageDetection,
} from '@twilio-preso/shared';
import type { Participant, RelayConfig, SessionRecord } from '@twilio-preso/shared';
import { requirePresenter } from '../services/auth.js';
import { requireTwilioSignature } from '../services/twilioSignature.js';
import { requireLiveSession } from '../services/sessionContext.js';
import { recall } from '../services/memory.js';
import { getSessionById } from '../services/sessions.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

/**
 * The origin every URL Twilio fetches must be built from. Twilio's signature
 * covers the full URL, so TwiML served from an origin other than
 * `publicBaseUrl` is rejected on arrival — silently, and only for real calls.
 */
function twimlBase(): string {
  return config.publicBaseUrl.replace(/\/$/, '');
}

/**
 * Rings every phone in the room with the same TwiML. `allSettled`, because one
 * unreachable handset must not cost the rest of the room the finale.
 */
async function callEveryone(
  participants: Participant[],
  from: string,
  url: string
): Promise<number> {
  const calls = await Promise.allSettled(
    participants.map((p) =>
      client.calls.create({ to: p.phone, from, machineDetection: 'Enable', url })
    )
  );
  return calls.filter((c) => c.status === 'fulfilled').length;
}

/** The relay's WebSocket URL, or null when the voice agent is not deployed. */
function relayUrl(): string | null {
  return process.env.CONVERSATION_RELAY_URL || null;
}

/**
 * The `<ConversationRelay>` TwiML for a session, built from that session's own
 * voice settings rather than from env vars — voice, language, ASR and the
 * handoff are per-presentation, edited in the HUD.
 *
 * The `<Dial>` after `</Connect>` is how the `handoff_to_human` tool actually
 * reaches a person: ending the relay session hands control back to TwiML, so the
 * verb after the `<Connect>` is what runs next. It is emitted only when the tool
 * is enabled and a number is known — an unconditional `<Dial>` would ring the
 * presenter at the end of every ordinary call.
 */
export function relayTwiml(session: SessionRecord | null, config: RelayConfig, url: string): string {
  /**
   * `multi` is Twilio's automatic language detection — Deepgram detects what the
   * caller speaks, ElevenLabs what the agent writes. It is only valid on that
   * provider pair, so the capability is derived rather than trusted: on any
   * other pair the primary language is pinned instead of ending the session.
   */
  const auto = config.autoDetectLanguage && supportsAutoLanguageDetection(config);
  const languages = resolvedLanguages(config);

  const attrs: string[] = [
    `url="${escapeXml(url)}"`,
    `voice="${escapeXml(config.voice)}"`,
    `ttsProvider="${escapeXml(config.ttsProvider)}"`,
    `language="${escapeXml(auto ? 'multi' : config.language)}"`,
    `transcriptionProvider="${escapeXml(config.transcriptionProvider)}"`,
    `dtmfDetection="${config.dtmfDetection}"`,
    `interruptible="${config.interruptible}"`,
    `interruptSensitivity="${config.interruptSensitivity}"`,
    `ignoreBackchannel="${config.ignoreBackchannel}"`,
    // The agent's own turns stream in as several `text` messages, so speech
    // arriving mid-turn has to be reported or an interruption can only land
    // between clauses — which is the one place the caller does not need it.
    `reportInputDuringAgentSpeech="${config.interruptible === 'none' ? 'none' : config.interruptible}"`,
  ];
  if (config.speechModel) attrs.push(`speechModel="${escapeXml(config.speechModel)}"`);
  // Only ElevenLabs reads this; sending it beside a Google or Amazon voice
  // describes a pairing that does not exist. Stated rather than left to the
  // platform default, for the same reason every language states its ASR.
  if (config.ttsProvider === 'ElevenLabs')
    attrs.push(`elevenlabsTextNormalization="${escapeXml(config.textNormalization)}"`);
  // Conversation Intelligence, when the account has a service. Omitted entirely
  // when it does not — an empty attribute is a 64101, not an unused feature.
  if (config.intelligenceService)
    attrs.push(`intelligenceService="${escapeXml(config.intelligenceService)}"`);
  // Unfinalized prompts. Only asked for when the session wants them — the app
  // ignores `last: false` either way, so this cannot make the agent answer twice.
  if (config.partialPrompts) attrs.push('partialPrompts="true"');

  /**
   * One `<Language>` per language the call may turn into. This is what makes the
   * agent's `[[switch_language:…]]` possible at all: the switch message selects
   * a language that was declared here, and one that was not ends the session.
   *
   * Each child carries its *own* voice. A `<Language>` inherits the parent's
   * otherwise, which means an English voice reading Tamil — worse than not
   * offering Tamil at all. Only the fields the session actually set are emitted,
   * so an inherited provider stays inherited rather than being pinned here.
   */
  const languageChildren = languages
    .map((lang) => {
      const langAttrs = [`code="${escapeXml(lang.code)}"`];
      if (lang.ttsProvider) langAttrs.push(`ttsProvider="${escapeXml(lang.ttsProvider)}"`);
      if (lang.voice) langAttrs.push(`voice="${escapeXml(lang.voice)}"`);
      if (lang.transcriptionProvider)
        langAttrs.push(`transcriptionProvider="${escapeXml(lang.transcriptionProvider)}"`);
      if (lang.speechModel) langAttrs.push(`speechModel="${escapeXml(lang.speechModel)}"`);
      return `\n      <Language ${langAttrs.join(' ')} />`;
    })
    .join('');

  const parameter = session
    ? `\n      <Parameter name="sessionId" value="${escapeXml(session.id)}" />`
    : '';

  const handoffTo = enabledRelayTools(config).some((t) => t.id === 'handoff_to_human')
    ? config.handoffNumber || session?.ownerPhone || ''
    : '';
  const dial = handoffTo ? `\n  <Dial>${escapeXml(handoffTo)}</Dial>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay ${attrs.join(' ')}>${parameter}${languageChildren}
    </ConversationRelay>
  </Connect>${dial}
</Response>`;
}

/** TwiML is built as a string here, so anything interpolated into an attribute
 *  is escaped. Session ids are uuids, but the escape is where it belongs. */
function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!
  );
}

interface TriggerBody {
  sessionId: string;
  triggerId: string;
  targetParticipantId?: string;
}

export async function triggerRoutes(app: FastifyInstance): Promise<void> {
  // Presenter-only and session-scoped: this fires real SMS and places real voice
  // calls to every registered phone — from that session's own number, to that
  // session's own roster.
  app.post<{ Body: TriggerBody }>(
    '/api/trigger',
    { preHandler: [requirePresenter, requireLiveSession] },
    async (request, reply) => {
      const session = request.session!;
      const from = session.phoneNumber;
      const { triggerId, targetParticipantId } = request.body;

      /**
       * The `isLive` gate, enforced here rather than only in the presenter.
       * Rehearsal has to be safe against every caller — a HUD manual-trigger
       * button, a second presenter laptop, a stale tab — not just against the
       * one client that happens to check its own store before posting.
       */
      if (!(await isSessionLive(session.id))) {
        return reply
          .status(409)
          .send({ error: 'Session is in rehearsal — arm it in the HUD to send real SMS and calls' });
      }

      const participants = await getAllParticipants(session.id);

      /**
       * A `whatsapp-` trigger is its `sms-` sibling on another channel — same
       * copy, same recipients — so the two share one branch rather than drifting
       * apart. The channel decides only how it is sent, and `whatsapp` still
       * means "SMS if WhatsApp cannot deliver to this person".
       */
      const onWhatsApp = triggerId.startsWith('whatsapp-');
      const channel: MessageChannel = onWhatsApp ? 'whatsapp' : 'sms';
      const kind = onWhatsApp ? triggerId.replace(/^whatsapp-/, 'sms-') : triggerId;

      switch (kind) {
        case 'sms-patience': {
          const sent = await sendToAllOnChannel(channel, from, participants, () => ({
            template: 'patience',
            values: [],
          }));
          return { ...sent, total: participants.length };
        }

        case 'sms-orchestrator': {
          const sent = await sendToAllOnChannel(channel, from, participants, (p) => ({
            template: 'orchestrator',
            values: [p.name],
          }));
          return { ...sent, total: participants.length };
        }

        case 'sms-memory': {
          // Ask Conversation Memory first: that is the thing being demonstrated,
          // and it can know something the attendee said at a previous event. The
          // session's own Sync response is the fallback for a phone with no
          // profile, or when memory is not configured at all.
          const recalled = new Map<string, string>();
          await Promise.all(
            participants.map(async (p) => {
              try {
                const memory = await recall(p.memoryProfileId, 'biggest customer experience challenge');
                if (memory) recalled.set(p.id, memory);
              } catch (err) {
                request.log.warn({ err, participantId: p.id }, 'memory recall failed');
              }
            })
          );

          const sent = await sendToAllOnChannel(channel, from, participants, (p) => {
            // A recalled observation is a sentence, not a phrase, so it gets its
            // own line — a different template, since an approved WhatsApp body is
            // fixed text and one body cannot be both shapes.
            const memory = recalled.get(p.id);
            if (memory) {
              return { template: 'memory-recall', values: [p.name, memory] };
            }
            // Keyed by stage id, so reordering or omitting slides cannot make this
            // read a different stage's answer. Falls back to generic copy when the
            // word-cloud stage is absent from the deck — validateDeck warns about
            // that case in the HUD rather than blocking the trigger.
            const challenge = responseFor(p, 'customers-are')?.value || 'customer experience';
            return { template: 'memory-answer', values: [p.name, challenge] };
          });
          return { sent: participants.length };
        }

        case 'voice-agent-connect': {
          if (!targetParticipantId) {
            return reply.status(400).send({ error: 'targetParticipantId required for voice trigger' });
          }
          const participant = await getParticipant(session.id, targetParticipantId);
          if (!participant) {
            return reply.status(404).send({ error: 'participant not found' });
          }
          /**
           * The live agent when it is deployed, the scripted Say/Dial handoff
           * when it is not: this trigger is fired at one volunteer with the room
           * watching, so it must place *a* call either way rather than refusing.
           * (The mass version does refuse — a whole-room finale that silently
           * becomes a recording is worse than a visible error.)
           */
          if (relayUrl()) {
            const call = await client.calls.create({
              to: participant.phone,
              from,
              url: `${twimlBase()}/api/voice/conversation-relay?sessionId=${encodeURIComponent(session.id)}`,
            });
            return { callSid: call.sid, mode: 'conversation-relay' };
          }
          const presenterPhone = process.env.PRESENTER_PHONE || '+61400000000';
          const callSid = await initiateAgentCall(from, participant.phone, presenterPhone);
          return { callSid, mode: 'static-twiml' };
        }

        /**
         * The scripted finale: every phone rings and hears the static bot. It
         * deliberately never uses ConversationRelay — `voice-mass-relay` is the
         * live-agent version of the same room-wide call, and a talk may show
         * either or both, so neither may change under the other.
         */
        case 'voice-mass-outbound': {
          const called = await callEveryone(
            participants,
            from,
            `${twimlBase()}/api/voice/demo-bot?sessionId=${encodeURIComponent(session.id)}`
          );
          return { called, total: participants.length, mode: 'static-twiml' };
        }

        /**
         * The same call, answered by the live agent — which resolves each caller
         * to their profile and greets them by name. Refuses when no relay is
         * configured rather than silently placing scripted calls: a finale that
         * quietly degrades to the other trigger's behaviour is worse on stage
         * than one that says it is not wired up.
         */
        case 'voice-mass-relay': {
          if (!relayUrl()) {
            return reply
              .status(409)
              .send({ error: 'CONVERSATION_RELAY_URL is not set — use voice-mass-outbound for the scripted bot' });
          }
          const url = `${twimlBase()}/api/voice/conversation-relay?sessionId=${encodeURIComponent(session.id)}`;
          const called = await callEveryone(participants, from, url);
          return { called, total: participants.length, mode: 'conversation-relay' };
        }

        case 'sms-closing': {
          const sent = await sendToAllOnChannel(channel, from, participants, (p) => ({
            template: 'closing',
            values: [p.name],
          }));
          return { ...sent, total: participants.length };
        }

        default:
          return reply.status(400).send({ error: `Unknown trigger: ${triggerId}` });
      }
    }
  );

  /**
   * The TwiML a call is answered with. Session-scoped through the query string,
   * which the signature covers, so it needs no change to validation: the
   * session's own voice settings decide every attribute, and the relay is told
   * which presentation it is on rather than inferring it from the number.
   */
  app.post<{ Querystring: { sessionId?: string } }>(
    '/api/voice/conversation-relay',
    { preHandler: requireTwilioSignature },
    async (request, reply) => {
      const url = relayUrl();
      const session = request.query.sessionId
        ? await getSessionById(request.query.sessionId)
        : null;
      reply.header('Content-Type', 'text/xml');
      if (!url) {
        // A call is already ringing, so say something rather than dropping it.
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>The voice agent is not configured for this event. Goodbye.</Say>
  <Hangup/>
</Response>`;
      }
      return relayTwiml(session, resolveRelayConfig(session?.relay), url);
    }
  );

  /**
   * One end-to-end call, on demand: the presenter's own phone, straight into the
   * agent with this session's settings. It is the only way to hear a prompt or a
   * voice change before an audience does.
   *
   * Calling *your own* number is allowed in rehearsal — that is the entire point
   * — but any other number is real outbound traffic and stays behind `isLive`,
   * so this cannot become the one route that texts a room from a draft.
   */
  app.post<{ Body: { sessionId?: string; to?: string } }>(
    '/api/voice/test-call',
    { preHandler: [requirePresenter, requireLiveSession] },
    async (request, reply) => {
      const session = request.session!;
      const url = relayUrl();
      if (!url) {
        return reply.status(409).send({ error: 'CONVERSATION_RELAY_URL is not set — nothing to call into' });
      }

      const presenterPhone = request.presenter!.phone;
      const to = (request.body?.to || presenterPhone).trim();
      if (to !== presenterPhone && !(await isSessionLive(session.id))) {
        return reply.status(409).send({
          error: 'Rehearsal only calls your own number — arm the session to test-call anyone else',
        });
      }

      const call = await client.calls.create({
        to,
        from: session.phoneNumber,
        url: `${twimlBase()}/api/voice/conversation-relay?sessionId=${encodeURIComponent(session.id)}`,
      });
      return { callSid: call.sid, to, from: session.phoneNumber };
    }
  );

  /**
   * The scripted bot's TwiML.
   *
   * It speaks in the **session's own agent voice** (`sayVoice`), not a
   * `TWILIO_VOICE` of its own: this trigger and `voice-mass-relay` are two
   * versions of the same moment in the talk, and a room that hears one voice from
   * the scripted call and another from the live agent hears two products. The
   * session is optional because a number's inbound `voiceUrl` also lands here —
   * without one it falls back to the shipped default rather than failing a call.
   */
  app.post<{ Querystring: { sessionId?: string } }>(
    '/api/voice/demo-bot',
    { preHandler: requireTwilioSignature },
    async (request, reply) => {
      const session = request.query.sessionId
        ? await getSessionById(request.query.sessionId)
        : null;
      const voice = sayVoice(resolveRelayConfig(session?.relay));
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">Hey there! Every phone in this room just rang at the same time — and what you watched today was a startup being created live, on stage, in front of you. That is the power of Twilio. Whether you are reaching one customer or a thousand, Twilio scales with you. If you like, call me back and we can talk about your individual experiences. Thanks for being part of it today.</Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
      reply.header('Content-Type', 'text/xml');
      return twiml;
    }
  );
}
