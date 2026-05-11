import type { WebSocket } from 'ws';
import { lookupParticipantByPhone } from './participant.js';
import { generateResponse, generateGreeting } from './llm.js';
import type { Participant } from '@twilio-preso/shared';

interface ConversationRelayEvent {
  type: 'setup' | 'prompt' | 'interrupt' | 'dtmf' | 'error';
  voicePrompt?: string;
  callerNumber?: string;
  callSid?: string;
  digit?: string;
  errorMessage?: string;
}

interface SessionState {
  participant: Participant | null;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  exchangeCount: number;
}

export async function handleConnection(ws: WebSocket): Promise<void> {
  const state: SessionState = {
    participant: null,
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
      if (event.callerNumber) {
        state.participant = await lookupParticipantByPhone(event.callerNumber);
        console.log(`Call connected: ${event.callerNumber} -> ${state.participant?.name || 'unknown'}`);
      }

      const greeting = generateGreeting(state.participant);
      state.conversationHistory.push({ role: 'assistant', content: greeting });
      sendResponse(ws, greeting);
      break;
    }

    case 'prompt': {
      const userMessage = event.voicePrompt || '';
      state.exchangeCount++;

      if (state.exchangeCount >= 3) {
        const farewell = `It was great chatting with you${state.participant?.name ? `, ${state.participant.name}` : ''}! Enjoy the rest of SIGNAL. Goodbye!`;
        state.conversationHistory.push({ role: 'user', content: userMessage });
        state.conversationHistory.push({ role: 'assistant', content: farewell });
        sendResponse(ws, farewell, true);
        return;
      }

      const response = await generateResponse(
        state.participant,
        state.conversationHistory,
        userMessage
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
