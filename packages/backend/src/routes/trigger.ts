import type { FastifyInstance } from 'fastify';
import Twilio from 'twilio';
import { config } from '../config.js';
import { getAllParticipants, getParticipant } from '../services/sync.js';
import { sendSmsToAll, sendSmsToParticipant } from '../services/messaging.js';
import { initiateAgentCall } from '../services/voice.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

interface TriggerBody {
  triggerId: string;
  targetParticipantId?: string;
}

export async function triggerRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: TriggerBody }>('/api/trigger', async (request, reply) => {
    const { triggerId, targetParticipantId } = request.body;
    const participants = await getAllParticipants();

    switch (triggerId) {
      case 'sms-patience': {
        await sendSmsToAll(participants, () =>
          `You've been on hold for 7 minutes. Still waiting...\n\nThis is what your customers feel every day. — Wonder by Twilio`
        );
        return { sent: participants.length };
      }

      case 'sms-orchestrator': {
        await sendSmsToAll(participants, (p) =>
          `Hey ${p.name}, following up from our earlier message. Notice how this conversation continued seamlessly across channels? That's Conversation Orchestrator. — Twilio`
        );
        return { sent: participants.length };
      }

      case 'sms-memory': {
        await sendSmsToAll(participants, (p) => {
          const challengeResponse = Object.values(p.responses).find((r) => r.stageIndex === 8);
          const challenge = challengeResponse?.value || 'customer experience';
          return `Hey ${p.name}, you said "${challenge}" was your biggest challenge. We remembered — no database lookup, no asking again. That's Conversation Memory. — Twilio`;
        });
        return { sent: participants.length };
      }

      case 'voice-agent-connect': {
        if (!targetParticipantId) {
          return reply.status(400).send({ error: 'targetParticipantId required for voice trigger' });
        }
        const participant = await getParticipant(targetParticipantId);
        if (!participant) {
          return reply.status(404).send({ error: 'participant not found' });
        }
        const presenterPhone = process.env.PRESENTER_PHONE || '+61400000000';
        const callSid = await initiateAgentCall(participant.phone, presenterPhone);
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
              from: config.twilio.phoneNumber,
              machineDetection: 'Enable',
              url: twimlUrl,
            })
          )
        );
        const succeeded = calls.filter((c) => c.status === 'fulfilled').length;
        return { called: succeeded, total: participants.length, mode: useRelay ? 'conversation-relay' : 'static-twiml' };
      }

      case 'sms-closing': {
        await sendSmsToAll(participants, (p) => {
          const responses = Object.values(p.responses);
          const pollResponse = responses.find((r) => r.stageIndex === 15);
          const excited = pollResponse?.value || 'our platform';
          return `Thanks for being part of the magic, ${p.name}! You showed interest in ${excited}. Let's keep this conversation going.\n\nletsGoMichelangeloMode(); — Wonder by Twilio`;
        });
        return { sent: participants.length };
      }

      default:
        return reply.status(400).send({ error: `Unknown trigger: ${triggerId}` });
    }
  });

  // TwiML endpoint for ConversationRelay mode
  app.post('/api/voice/conversation-relay', async (request, reply) => {
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
  app.post('/api/voice/demo-bot', async (request, reply) => {
    const voice = process.env.TWILIO_VOICE || 'Google.en-AU-Neural2-B';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">Hey there! You just experienced a mass outbound call from an AI agent that was built live, on stage, in under 5 minutes. That's the power of Twilio. Every phone in the room just rang simultaneously. Whether you're reaching 1 customer or 1000, Twilio scales with you. Thanks for being part of the magic today. See you at the next SIGNAL!</Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
    reply.header('Content-Type', 'text/xml');
    return twiml;
  });
}
