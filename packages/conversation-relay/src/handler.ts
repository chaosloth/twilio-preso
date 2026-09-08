import type { WebSocket } from 'ws';
import { lookupParticipantByPhone } from './participant.js';
import { resolveSession } from './session.js';
import { buildCallerContext, generateGreeting, streamResponse } from './llm.js';
import type { CallerContext } from './llm.js';
import { fetchProfileContext, lookupProfileByPhone, recallForProfile } from './memory.js';
import { fetchSessionConfig } from './relayConfig.js';
import { extractToolCalls, sendFollowupSms } from './tools.js';
import {
  SentinelSafeStream,
  endMessage,
  errorDescription,
  textMessage,
  trimToInterrupt,
  turnTail,
} from './protocol.js';
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
  /** Interrupt only: how much of the agent's line the caller actually heard. */
  utteranceUntilInterrupt?: string;
  /** Error only. Twilio calls it `description`; there is no `errorMessage`. */
  description?: string;
}

/** What a turn says when the model gives nothing usable. A stumble is
 *  recoverable; silence on a live call is not. */
const STUMBLE = "Sorry, I'm having trouble thinking straight for a moment. Could you say that again?";

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
        sendResponse(ws, farewell);
        hangUp(ws, state);
        return;
      }

      /**
       * A failed turn has to say *something*. The outer handler catches the
       * throw and logs it, which on a phone call is indistinguishable from the
       * agent having hung up — the caller is left holding silence. A dead model
       * or an expired key (the local smoke run hit exactly that) should sound
       * like a stumble, not a dropped call.
       *
       * The reply is streamed clause by clause so the caller hears the first
       * sentence while the model is still writing the rest. `SentinelSafeStream`
       * is what makes that safe: a tool sentinel is plain text in the stream, and
       * flushing eagerly would have the agent read out its own tool call.
       */
      const stream = new SentinelSafeStream();
      let spoke = false;
      try {
        for await (const chunk of streamResponse(
          state.caller,
          state.config,
          state.conversationHistory,
          userMessage
        )) {
          const speakable = stream.push(chunk);
          if (speakable) {
            spoke = true;
            ws.send(JSON.stringify(textMessage(speakable, { last: false })));
          }
        }
      } catch (err) {
        console.error('Response generation failed:', err);
        // Whatever was already spoken has to be closed off before the apology,
        // or Twilio is still waiting on the tail of the previous turn.
        ws.send(
          JSON.stringify(
            textMessage(
              turnTail(spoke, stream.flush(), STUMBLE),
              { last: true }
            )
          )
        );
        if (spoke) ws.send(JSON.stringify(textMessage(STUMBLE, { last: true })));
        return;
      }

      /**
       * Tools, before the tail is spoken. The tokens are stripped from the text
       * either way — the caller must never hear one — and the history keeps the
       * spoken words, so a later turn is not conditioned on a token the model
       * would then copy.
       */
      const { text: response, called } = extractToolCalls(stream.text(), state.config);
      ws.send(JSON.stringify(textMessage(turnTail(spoke, stream.flush(), STUMBLE), { last: true })));

      state.conversationHistory.push({ role: 'user', content: userMessage });
      state.conversationHistory.push({ role: 'assistant', content: response || STUMBLE });

      if (called.includes('send_followup_sms')) {
        void sendFollowupSms(state.session, state.callerPhone, response);
      }

      if (called.includes('handoff_to_human')) {
        // Ending the relay session returns control to TwiML, where the `<Dial>`
        // the backend emitted after `</Connect>` connects the human.
        ws.send(JSON.stringify(endMessage('handoff_to_human')));
        return;
      }

      if (called.includes('end_call')) {
        hangUp(ws, state);
      }
      break;
    }

    case 'interrupt': {
      // Keep only what the caller heard. The rest of that sentence was never
      // spoken, and a model conditioned on it answers a question nobody asked.
      state.conversationHistory = trimToInterrupt(
        state.conversationHistory,
        event.utteranceUntilInterrupt ?? ''
      );
      console.log(`Interrupted after: "${event.utteranceUntilInterrupt ?? ''}"`);
      break;
    }

    case 'dtmf': {
      console.log(`DTMF: ${event.digit}`);
      break;
    }

    case 'error': {
      console.error('ConversationRelay error:', errorDescription(event));
      break;
    }
  }
}

function sendResponse(ws: WebSocket, text: string): void {
  ws.send(JSON.stringify(textMessage(text, { last: true })));
}

/**
 * End the call after the last line has been spoken.
 *
 * An `end` sent immediately cuts the goodbye off mid-word — Twilio stops the
 * session, not the TTS queue — so it waits for roughly as long as the words take
 * to say. Rough is fine: overshooting is a beat of silence, undershooting is a
 * severed farewell.
 */
function hangUp(ws: WebSocket, state: SessionState): void {
  const spoken = state.conversationHistory[state.conversationHistory.length - 1]?.content ?? '';
  const words = spoken.split(/\s+/).filter(Boolean).length;
  const ms = Math.min(15000, 1500 + words * 400);
  setTimeout(() => ws.send(JSON.stringify(endMessage('end_call'))), ms);
}
