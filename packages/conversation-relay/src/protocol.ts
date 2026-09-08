/**
 * The ConversationRelay wire protocol, as message builders.
 *
 * Twilio validates every message we send and *silently discards* one that
 * carries an attribute the schema does not declare — error 64107, session
 * intact, message gone. So the shapes live here, in one tested place, rather
 * than being assembled inline where an extra field looks harmless.
 */

export interface TextMessage {
  type: 'text';
  token: string;
  last: boolean;
  interruptible?: boolean;
}

export interface EndMessage {
  type: 'end';
  /** Twilio requires a string here, not an object — it is passed through to the
   *  status callback verbatim. */
  handoffData: string;
}

export function textMessage(
  token: string,
  options: { last: boolean; interruptible?: boolean }
): TextMessage {
  const message: TextMessage = { type: 'text', token, last: options.last };
  if (options.interruptible !== undefined) message.interruptible = options.interruptible;
  return message;
}

/**
 * Hanging up. This is a message type of its own: there is no `handoff`
 * attribute on `text`, and adding one is how the agent went silent in
 * production — the farewell was discarded and the call was never ended.
 */
export function endMessage(reason: string): EndMessage {
  return { type: 'end', handoffData: JSON.stringify({ reason }) };
}

export interface LanguageMessage {
  type: 'language';
  ttsLanguage?: string;
  transcriptionLanguage?: string;
}

/**
 * Switch the language mid-call.
 *
 * The two directions are separate on purpose — the caller's speech and the
 * agent's voice can legitimately be different languages — and Twilio needs at
 * least one of them. An absent side is omitted rather than sent empty: an
 * attribute the schema does not expect gets the whole message discarded.
 */
export function languageMessage(options: {
  tts?: string;
  transcription?: string;
}): LanguageMessage | null {
  if (!options.tts && !options.transcription) return null;
  const message: LanguageMessage = { type: 'language' };
  if (options.tts) message.ttsLanguage = options.tts;
  if (options.transcription) message.transcriptionLanguage = options.transcription;
  return message;
}

/** A tool call the model wrote inline, with its argument if it takes one. */
export interface SentinelCall {
  id: string;
  arg: string;
}

/**
 * Pulls the tool sentinels out of a reply.
 *
 * Only the ids passed in are recognised: a token for a tool this session has
 * switched off stays in the text, where it is visible in a transcript, rather
 * than silently performing an action the presenter disabled. `switch_language`
 * is why the argument exists — the tag travels in the sentinel itself.
 */
export function extractSentinels(
  reply: string,
  ids: readonly string[]
): { text: string; calls: SentinelCall[] } {
  const calls: SentinelCall[] = [];
  let text = reply;

  for (const id of ids) {
    const pattern = new RegExp(`\\[\\[${id}(?::([^\\]]*))?\\]\\]`, 'g');
    text = text.replace(pattern, (_match, arg?: string) => {
      calls.push({ id, arg: (arg ?? '').trim() });
      return ' ';
    });
  }

  return { text: text.replace(/\s{2,}/g, ' ').trim(), calls };
}

/** Twilio's error field is `description`. Reading `errorMessage` logs undefined. */
export function errorDescription(event: { description?: string }): string {
  return event.description ?? '(no description sent)';
}

type Turn = { role: 'user' | 'assistant'; content: string };

/**
 * Cut the agent's last turn down to the words the caller actually heard.
 *
 * `interrupt` reports `utteranceUntilInterrupt` for exactly this reason: the
 * rest of the reply was never spoken, and leaving it in history conditions the
 * next turn on sentences the caller has no idea were said.
 */
export function trimToInterrupt(history: Turn[], utteranceUntilInterrupt: string): Turn[] {
  const last = history[history.length - 1];
  if (!utteranceUntilInterrupt || !last || last.role !== 'assistant') return history;
  return [...history.slice(0, -1), { ...last, content: utteranceUntilInterrupt }];
}

/**
 * The final `text` token of a turn.
 *
 * Twilio needs a `last: true` to close the turn, and an empty one is only legal
 * because something was already spoken. When the model produced no words at all
 * — a filtered completion, a proxy swallowing the API host — an empty final
 * token is a silent turn: the caller asks a question and hears nothing. So that
 * one case speaks the fallback instead.
 */
export function turnTail(spokeAlready: boolean, tail: string, fallback: string): string {
  if (tail) return tail;
  return spokeAlready ? '' : fallback;
}

/** A completed clause: what is safe to hand to TTS before the rest arrives. */
const SENTENCE_END = /^[\s\S]*[.!?…]["')\]]?(\s+|$)/;
/** A tool sentinel, or the start of one. */
const SENTINEL = /\[\[[a-z_]*(?::[^\]]*)?\]?\]?/gi;

/**
 * Turns an LLM token stream into speakable chunks.
 *
 * Streaming is what fixes slow turn-taking — TTS starts on the first sentence
 * instead of after the last token. The hazard it introduces is that tool
 * sentinels (`[[end_call]]`) are ordinary text in that stream: flush eagerly and
 * the caller hears the agent read out its own tool call. So everything from an
 * opening `[[` is held back until the turn ends, and the sentinels are stripped
 * from whatever is left.
 */
export class SentinelSafeStream {
  private raw = '';
  private pending = '';

  /** Feed a token. Returns the text that is safe to speak now, possibly ''. */
  push(chunk: string): string {
    this.raw += chunk;
    this.pending += chunk;

    // Never speak past an opening bracket run: it may still become a sentinel.
    const bracket = this.pending.indexOf('[[');
    const speakable = bracket === -1 ? this.pending : this.pending.slice(0, bracket);

    const match = SENTENCE_END.exec(speakable);
    if (!match) return '';

    this.pending = this.pending.slice(match[0].length);
    return match[0];
  }

  /** The tail, sentinels removed. Call once the stream has ended. */
  flush(): string {
    const text = this.pending.replace(SENTINEL, '').replace(/\s+/g, ' ').trim();
    this.pending = '';
    return text;
  }

  /** The whole reply as the model wrote it, sentinels included — this is what
   *  tool extraction reads, since the tokens are stripped before speaking. */
  text(): string {
    return this.raw;
  }
}
