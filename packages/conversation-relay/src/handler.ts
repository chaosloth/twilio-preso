import type { WebSocket } from 'ws';
import { lookupParticipantByPhone } from './participant.js';
import { resolveSession } from './session.js';
import { generateResponse, generateGreeting } from './llm.js';
import { recallForProfile } from './memory.js';
import type { Participant } from '@twilio-preso/shared';

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
  participant: Participant | null;
  /** Recalled from Conversation Memory once at setup. Null when memory is off,
   *  the caller has no profile, or nothing was remembered. */
  memoryContext: string | null;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  exchangeCount: number;
}

export async function handleConnection(ws: WebSocket): Promise<void> {
  const state: SessionState = {
    sessionId: null,
    participant: null,
    memoryContext: null,
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
      // Resolve the presentation first: participants live in a per-session map,
      // so without a session there is nobody to look up. An unresolved call
      // still gets the generic greeting rather than silence.
      const call = await resolveSession(event);
      if (!call) {
        console.warn(`Call from ${event.from} to ${event.to} matched no session — greeting generically`);
      } else {
        state.sessionId = call.sessionId;
        if (call.participantPhone) {
          state.participant = await lookupParticipantByPhone(call.sessionId, call.participantPhone);
        }
        console.log(
          `Call connected: ${call.participantPhone} in session ${call.sessionId} -> ${state.participant?.name || 'unknown'}`
        );
      }

      // Recalled once at setup rather than per turn: this is a phone call, and a
      // memory round-trip between every question and answer is dead air.
      state.memoryContext = await recallForProfile(
        state.participant?.memoryProfileId,
        'customer experience challenges and what they want to build'
      );

      const greeting = generateGreeting(state.participant);
      state.conversationHistory.push({ role: 'assistant', content: greeting });
      sendResponse(ws, greeting);
      break;
    }

    case 'prompt': {
      const userMessage = event.voicePrompt || '';
      state.exchangeCount++;

      if (state.exchangeCount >= 3) {
        const farewell = `It was great chatting with you${state.participant?.name ? `, ${state.participant.name}` : ''}! We can't wait to see what you build with Twilio. Goodbye!`;
        state.conversationHistory.push({ role: 'user', content: userMessage });
        state.conversationHistory.push({ role: 'assistant', content: farewell });
        sendResponse(ws, farewell, true);
        return;
      }

      const response = await generateResponse(
        state.participant,
        state.conversationHistory,
        userMessage,
        state.memoryContext
      );

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
