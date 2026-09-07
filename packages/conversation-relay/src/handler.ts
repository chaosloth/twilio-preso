import type { WebSocket } from 'ws';
import { lookupParticipantByPhone } from './participant.js';
import { resolveSession } from './session.js';
import { buildCallerContext, generateResponse, generateGreeting } from './llm.js';
import type { CallerContext } from './llm.js';
import { fetchProfileContext, lookupProfileByPhone, recallForProfile } from './memory.js';

interface ConversationRelayEvent {
  type: 'setup' | 'prompt' | 'interrupt' | 'dtmf' | 'error';
  voicePrompt?: string;
  /** Setup only. `from`/`to`/`direction` are what Twilio actually sends. */
  from?: string;
  to?: string;
  direction?: string;
  customParameters?: Record<string, string>;
  callSid?: string;
  digit?: string;
  errorMessage?: string;
}

interface SessionState {
  /** Which presentation this call belongs to. Null if it could not be resolved. */
  sessionId: string | null;
  /** Everything known about the caller, assembled once at setup — a memory
   *  round-trip between every question and answer is dead air on a phone call. */
  caller: CallerContext;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  exchangeCount: number;
}

/**
 * How many turns the agent takes before it says goodbye.
 *
 * The outbound finale is one beat of a presentation with a room watching, so it
 * wraps up fast. Someone who chose to ring in is having a conversation, and
 * hanging up on them after three turns is the demo failing in front of them.
 */
const MAX_EXCHANGES_OUTBOUND = 3;
const MAX_EXCHANGES_INBOUND = 12;

export async function handleConnection(ws: WebSocket): Promise<void> {
  const state: SessionState = {
    sessionId: null,
    caller: buildCallerContext(null, null, false),
    conversationHistory: [],
    exchangeCount: 0,
  };

  ws.on('message', async (data) => {
    try {
      const event: ConversationRelayEvent = JSON.parse(data.toString());
      await handleEvent(ws, event, state);
    } catch (err) {
      console.error('Error handling ConversationRelay event:', err);
    }
  });

  ws.on('close', () => {
    console.log('ConversationRelay connection closed');
  });
}

async function handleEvent(
  ws: WebSocket,
  event: ConversationRelayEvent,
  state: SessionState
): Promise<void> {
  switch (event.type) {
    case 'setup': {
      const inbound = !(event.direction?.startsWith('outbound') ?? false);

      // Resolve the presentation first: participants live in a per-session map,
      // so without a session there is nobody to look up. An unresolved call
      // still gets greeted rather than met with silence.
      const call = await resolveSession(event);
      let participant = null;
      if (!call) {
        console.warn(`Call from ${event.from} to ${event.to} matched no session — greeting generically`);
      } else {
        state.sessionId = call.sessionId;
        if (call.participantPhone) {
          participant = await lookupParticipantByPhone(call.sessionId, call.participantPhone);
        }
        console.log(
          `Call connected: ${call.participantPhone} in session ${call.sessionId} -> ${participant?.name || 'unknown'}`
        );
      }

      // The participant record carries the profile id when they registered here.
      // Falling back to a phone lookup is what makes calling *in* work at all:
      // an inbound caller may have registered at a previous event, or not be in
      // this session's map, and the phone identifier still resolves them.
      const callerPhone = call?.participantPhone ?? (inbound ? event.from ?? null : event.to ?? null);
      const profileId = participant?.memoryProfileId ?? (await lookupProfileByPhone(callerPhone));

      const [profile, recall] = await Promise.all([
        fetchProfileContext(profileId ?? undefined),
        recallForProfile(
          profileId ?? undefined,
          'customer experience challenges and what they want to build'
        ),
      ]);

      state.caller = buildCallerContext(participant, profile, inbound);
      state.caller.recall = recall;

      const greeting = await generateGreeting(state.caller);
      state.conversationHistory.push({ role: 'assistant', content: greeting });
      sendResponse(ws, greeting);
      break;
    }

    case 'prompt': {
      const userMessage = event.voicePrompt || '';
      state.exchangeCount++;

      const limit = state.caller.inbound ? MAX_EXCHANGES_INBOUND : MAX_EXCHANGES_OUTBOUND;
      if (state.exchangeCount >= limit) {
        const name = state.caller.name ? `, ${state.caller.name}` : '';
        const farewell = `It was great chatting with you${name}! We can't wait to see what you build with Twilio. Goodbye!`;
        state.conversationHistory.push({ role: 'user', content: userMessage });
        state.conversationHistory.push({ role: 'assistant', content: farewell });
        sendResponse(ws, farewell, true);
        return;
      }

      const response = await generateResponse(state.caller, state.conversationHistory, userMessage);

      state.conversationHistory.push({ role: 'user', content: userMessage });
      state.conversationHistory.push({ role: 'assistant', content: response });
      sendResponse(ws, response);
      break;
    }

    case 'interrupt': {
      console.log('User interrupted');
      break;
    }

    case 'dtmf': {
      console.log(`DTMF: ${event.digit}`);
      break;
    }

    case 'error': {
      console.error('ConversationRelay error:', event.errorMessage);
      break;
    }
  }
}

function sendResponse(ws: WebSocket, text: string, hangup = false): void {
  const message: Record<string, unknown> = {
    type: 'text',
    token: text,
    last: true,
  };

  if (hangup) {
    message.handoff = { type: 'hangup' };
  }

  ws.send(JSON.stringify(message));
}
