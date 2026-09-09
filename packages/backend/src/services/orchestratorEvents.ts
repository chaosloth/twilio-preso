/**
 * The pure half of the Conversation Orchestrator text agent: deciding whether an
 * event is a message the agent should answer, and turning a conversation's
 * communications into LLM history.
 *
 * Separate from the client and the route because these are the two places the
 * feature can fail in ways nothing else notices — an answered event that should
 * have been dropped is an SMS loop, and history read with the roles the wrong way
 * round is an agent arguing with itself — and both are testable without Twilio.
 */

/** Twilio's channel enum on a Communication. */
export type OrchestratorChannel = 'VOICE' | 'SMS' | 'RCS' | 'WHATSAPP' | 'CHAT';

export interface OrchestratorParty {
  address: string;
  channel?: OrchestratorChannel;
  participantId?: string;
}

export interface OrchestratorCommunication {
  id?: string;
  conversationId?: string;
  author: OrchestratorParty;
  content: { type: string; text?: string };
  recipients?: OrchestratorParty[];
  resourceId?: string;
  createdAt?: string;
}

export interface OrchestratorEvent {
  eventType: string;
  timestamp?: string;
  data: OrchestratorCommunication;
}

/** What the route needs to answer a message, once the event has earned a reply. */
export interface InboundText {
  conversationId: string;
  /** The sender, as E.164 — the `whatsapp:` prefix stripped, so it matches a
   *  participant record and a memory `phone` identifier. */
  from: string;
  /** Which of this deployment's pool numbers was written to. The session is
   *  resolved from it, the same way the voice agent resolves a call. */
  poolNumber: string;
  channel: 'sms' | 'whatsapp';
  text: string;
}

/** `whatsapp:+61…` and `rcs:+61…` are the same phone as `+61…`. */
export function bareAddress(address: string): string {
  return address.replace(/^[a-z]+:/i, '').trim();
}

const TEXT_CHANNELS = new Set<OrchestratorChannel>(['SMS', 'RCS', 'WHATSAPP']);

/**
 * The guard, and the only thing standing between this feature and a self-sustaining
 * SMS loop.
 *
 * Capture rules are bidirectional — they have to be, or the agent's own side of
 * the thread never reaches the conversation history — which means every reply
 * this app sends comes back as another `COMMUNICATION_CREATED`, authored by the
 * pool number. Dropping those is what makes one inbound message produce one
 * reply instead of an unbounded exchange with itself.
 *
 * Everything else here is the same shape of caution: only new text on a text
 * channel, only to a number this deployment actually owns.
 */
export function inboundText(
  event: OrchestratorEvent,
  poolNumbers: string[]
): InboundText | null {
  // `COMMUNICATION_UPDATED` fires on every delivery-status change of a message
  // that has already been answered.
  if (event?.eventType !== 'COMMUNICATION_CREATED') return null;

  const data = event.data;
  if (!data?.author?.address) return null;
  if (data.content?.type !== 'TEXT') return null;

  const text = (data.content.text ?? '').trim();
  if (!text) return null;

  const owned = new Set(poolNumbers.map(bareAddress));
  const from = bareAddress(data.author.address);
  // The loop guard.
  if (owned.has(from)) return null;

  const recipient = (data.recipients ?? []).find((r) => owned.has(bareAddress(r.address)));
  if (!recipient) return null;

  const channel = data.author.channel ?? recipient.channel;
  if (channel && !TEXT_CHANNELS.has(channel)) return null;

  return {
    conversationId: data.conversationId ?? '',
    from,
    poolNumber: bareAddress(recipient.address),
    // RCS is answered as SMS: the classic Messages API this app uses for its
    // per-session `from` has no RCS sender, and Twilio delivers the SMS to the
    // same thread.
    channel: channel === 'WHATSAPP' ? 'whatsapp' : 'sms',
    text,
  };
}

/** How many turns of the thread the model is given. Enough to hold a short
 *  exchange, short enough that a long-running thread does not grow the prompt
 *  without bound. */
const HISTORY_TURNS = 12;

/**
 * The thread as LLM history.
 *
 * Whose turn is whose is decided by the address, not by an ordering assumption:
 * anything the pool number sent is the agent's, everything else is the person's.
 * Getting that backwards produces an agent that answers its own last reply.
 */
export function historyFromCommunications(
  communications: OrchestratorCommunication[],
  poolNumber: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const ours = bareAddress(poolNumber);
  return communications
    .filter((c) => c.content?.type === 'TEXT' && (c.content.text ?? '').trim())
    .map((c) => ({
      role: bareAddress(c.author?.address ?? '') === ours ? ('assistant' as const) : ('user' as const),
      content: (c.content.text ?? '').trim(),
    }))
    .slice(-HISTORY_TURNS);
}
