import type { WebSocket } from 'ws';
import { lookupParticipantByPhone } from './participant.js';
import { resolveSession } from './session.js';
import { buildCallerContext, generateResponse, generateGreeting } from './llm.js';
import type { CallerContext } from './llm.js';
import { fetchProfileContext, lookupProfileByPhone, recallForProfile } from './memory.js';
import { fetchSessionConfig } from './relayConfig.js';
import { extractToolCalls, sendFollowupSms } from './tools.js';
import { resolveRelayConfig } from '@twilio-preso/shared';
import type { RelayConfig, SessionRecord } from '@twilio-preso/shared';

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
  /** That presentation's voice settings — prompt, greeting, tools, turn limits.
   *  Read once at setup; the defaults until then, so a call that arrives before
   *  the lookup finishes is still answered. */
  config: RelayConfig;
  /** The session record, for the tools that need its number. */
  session: SessionRecord | null;
  /** Who is on the line, for a follow-up message. */
  callerPhone: string | null;
  /** Everything known about the caller, assembled once at setup — a memory
   *  round-trip between every question and answer is dead air on a phone call. */
  caller: CallerContext;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  exchangeCount: number;
}

export async function handleConnection(ws: WebSocket): Promise<void> {
  const state: SessionState = {
    sessionId: null,
    config: resolveRelayConfig(),
    session: null,
    callerPhone: null,
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

      // Voice settings before the first spoken word: the greeting, the prompt
      // and whether memory is read at all come from this session's own config.
      const settings = await fetchSessionConfig(state.sessionId);
      state.config = settings.config;
      state.session = settings.session;

      // The participant record carries the profile id when they registered here.
      // Falling back to a phone lookup is what makes calling *in* work at all:
      // an inbound caller may have registered at a previous event, or not be in
      // this session's map, and the phone identifier still resolves them.
      const callerPhone = call?.participantPhone ?? (inbound ? event.from ?? null : event.to ?? null);
      state.callerPhone = callerPhone;

      // `useMemory` off is a demo choice, not a failure: it shows the agent
      // working from this session's answers alone, so the profile is not read.
      const profileId = state.config.useMemory
        ? participant?.memoryProfileId ?? (await lookupProfileByPhone(callerPhone))
        : null;

      const [profile, recall] = await Promise.all([
        fetchProfileContext(profileId ?? undefined),
        recallForProfile(
          profileId ?? undefined,
          'customer experience challenges and what they want to build'
        ),
      ]);

      state.caller = buildCallerContext(participant, profile, inbound);
      state.caller.recall = recall;

      const greeting = await generateGreeting(state.caller, state.config);
      state.conversationHistory.push({ role: 'assistant', content: greeting });
      sendResponse(ws, greeting);
      break;
    }

    case 'prompt': {
      const userMessage = event.voicePrompt || '';
      state.exchangeCount++;

      const limit = state.caller.inbound
        ? state.config.maxTurnsInbound
        : state.config.maxTurnsOutbound;
      if (state.exchangeCount >= limit) {
        const name = state.caller.name ? `, ${state.caller.name}` : '';
        const farewell = `It was great chatting with you${name}! We can't wait to see what you build with Twilio. Goodbye!`;
        state.conversationHistory.push({ role: 'user', content: userMessage });
        state.conversationHistory.push({ role: 'assistant', content: farewell });
        sendResponse(ws, farewell, true);
        return;
      }

      /**
       * A failed turn has to say *something*. The outer handler catches the
       * throw and logs it, which on a phone call is indistinguishable from the
       * agent having hung up — the caller is left holding silence. A dead model
       * or an expired key (the local smoke run hit exactly that) should sound
       * like a stumble, not a dropped call.
       */
      let reply: string;
      try {
        reply = await generateResponse(
          state.caller,
          state.config,
          state.conversationHistory,
          userMessage
        );
      } catch (err) {
        console.error('Response generation failed:', err);
        sendResponse(ws, "Sorry, I'm having trouble thinking straight for a moment. Could you say that again?");
        return;
      }

      /**
       * Tools, before anything is spoken. The tokens are stripped from the text
       * either way — the caller must never hear one — and the history keeps the
       * spoken words, so a later turn is not conditioned on a token the model
       * would then copy.
       */
      const { text: response, called } = extractToolCalls(reply, state.config);

      state.conversationHistory.push({ role: 'user', content: userMessage });
      state.conversationHistory.push({ role: 'assistant', content: response });

      if (called.includes('send_followup_sms')) {
        void sendFollowupSms(state.session, state.callerPhone, response);
      }

      if (called.includes('handoff_to_human')) {
        // Ending the relay session returns control to TwiML, where the `<Dial>`
        // the backend emitted after `</Connect>` connects the human. Saying the
        // line first, so the transfer is not silent.
        sendResponse(ws, response);
        ws.send(JSON.stringify({ type: 'end', handoffData: JSON.stringify({ reason: 'handoff_to_human' }) }));
        return;
      }

      sendResponse(ws, response, called.includes('end_call'));
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
