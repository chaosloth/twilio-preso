import type { FastifyInstance } from 'fastify';
import Twilio from 'twilio';
import { config } from '../config.js';
import { getAllParticipants, getParticipant } from '../services/sync.js';
import { sendSmsToAll, sendSmsToParticipant } from '../services/messaging.js';
import { initiateAgentCall } from '../services/voice.js';
import { responseFor } from '@twilio-preso/shared';
import { requirePresenter } from '../services/auth.js';
import { requireTwilioSignature } from '../services/twilioSignature.js';
import { requireLiveSession } from '../services/sessionContext.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

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
      const participants = await getAllParticipants(session.id);

      switch (triggerId) {
        case 'sms-patience': {
          await sendSmsToAll(from, participants, () =>
            `You've been on hold for 7 minutes. Still waiting...\n\nThis is what your customers feel every day. — Wonder by Twilio`
          );
          return { sent: participants.length };
        }

        case 'sms-orchestrator': {
          await sendSmsToAll(from, participants, (p) =>
            `Hey ${p.name}, following up from our earlier message. Notice how this conversation continued seamlessly across channels? That's Conversation Orchestrator. — Twilio`
          );
          return { sent: participants.length };
        }

        case 'sms-memory': {
          await sendSmsToAll(from, participants, (p) => {
            // Keyed by stage id, so reordering or omitting slides cannot make this
            // read a different stage's answer. Falls back to generic copy when the
            // word-cloud stage is absent from the deck — validateDeck warns about
            // that case in the HUD rather than blocking the trigger.
            const challenge = responseFor(p, 'customers-are')?.value || 'customer experience';
            return `Hey ${p.name}, you said "${challenge}" was your biggest challenge. We remembered — no database lookup, no asking again. That's Conversation Memory. — Twilio`;
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
          const presenterPhone = process.env.PRESENTER_PHONE || '+61400000000';
          const callSid = await initiateAgentCall(from, participant.phone, presenterPhone);
          return { callSid };
        }

        case 'voice-mass-outbound': {
          const useRelay = !!process.env.CONVERSATION_RELAY_URL;
          const twimlUrl = useRelay
            ? `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/voice/conversation-relay`
            : `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/voice/demo-bot`;

          const calls = await Promise.allSettled(
            participants.map((p) =>
              client.calls.create({
                to: p.phone,
                from,
                machineDetection: 'Enable',
                url: twimlUrl,
              })
            )
          );
          const succeeded = calls.filter((c) => c.status === 'fulfilled').length;
          return { called: succeeded, total: participants.length, mode: useRelay ? 'conversation-relay' : 'static-twiml' };
        }

        case 'sms-closing': {
          await sendSmsToAll(from, participants, (p) =>
            `Thanks for joining us, ${p.name}! Want to explore the demo yourself? Check it out here: https://www.twilio.com/en-us/solutions/agent-productivity\n\nletsGoMichelangeloMode(); — Wonder by Twilio`
          );
          return { sent: participants.length };
        }

        default:
          return reply.status(400).send({ error: `Unknown trigger: ${triggerId}` });
      }
    }
  );

  // TwiML endpoint for ConversationRelay mode
  app.post('/api/voice/conversation-relay', { preHandler: requireTwilioSignature }, async (request, reply) => {
    const conversationRelayUrl = process.env.CONVERSATION_RELAY_URL || 'wss://localhost:3003';
    const voice = process.env.TWILIO_VOICE || 'Google.en-AU-Neural2-B';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay url="${conversationRelayUrl}" voice="${voice}" dtmfDetection="true" interruptible="true" />
  </Connect>
</Response>`;
    reply.header('Content-Type', 'text/xml');
    return twiml;
  });

  // TwiML endpoint for static fallback bot
  app.post('/api/voice/demo-bot', { preHandler: requireTwilioSignature }, async (request, reply) => {
    const voice = process.env.TWILIO_VOICE || 'Google.en-AU-Neural2-B';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">Hey there! You just experienced a mass outbound call from an AI agent that was built live, on stage, in under 5 minutes. That's the power of Twilio. Every phone in the room just rang simultaneously. Whether you're reaching 1 customer or 1000, Twilio scales with you. Thanks for being part of the magic today. We can't wait to see what you build with Twilio.</Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
    reply.header('Content-Type', 'text/xml');
    return twiml;
  });
}
