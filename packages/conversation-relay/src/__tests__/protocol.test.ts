import { describe, expect, it } from 'vitest';
import { endMessage, errorDescription, textMessage, trimToInterrupt, turnTail } from '../protocol.js';
import { SentinelSafeStream } from '../protocol.js';

describe('textMessage', () => {
  /**
   * ConversationRelay validates every inbound message against a schema and
   * *discards* one that carries an unknown attribute (error 64107) — it does not
   * fail loudly. That is what silenced the agent in production: a `handoff`
   * attribute was bolted onto a `text` message, so the farewell was never spoken
   * and the call never ended.
   */
  it('carries only the attributes the text message accepts', () => {
    expect(textMessage('hello', { last: true })).toEqual({
      type: 'text',
      token: 'hello',
      last: true,
    });
  });

  it('marks a partial token as not-last so the rest of the sentence can follow', () => {
    expect(textMessage('hel', { last: false }).last).toBe(false);
  });

  it('can mark a turn uninterruptible without inventing an attribute', () => {
    expect(textMessage('bye', { last: true, interruptible: false })).toEqual({
      type: 'text',
      token: 'bye',
      last: true,
      interruptible: false,
    });
  });
});

describe('endMessage', () => {
  /** Hanging up is its own message type, never an attribute on `text`. */
  it('is a separate end message carrying a string handoffData', () => {
    const message = endMessage('end_call');
    expect(message.type).toBe('end');
    expect(JSON.parse(message.handoffData)).toEqual({ reason: 'end_call' });
  });
});

describe('errorDescription', () => {
  /** Twilio's error message field is `description`. Reading `errorMessage` is
   *  why the only production log line was `ConversationRelay error: undefined`. */
  it('reads the field Twilio actually sends', () => {
    expect(errorDescription({ description: 'Invalid message' })).toBe(
      'Invalid message'
    );
  });

  it('says so rather than logging undefined when the field is missing', () => {
    expect(errorDescription({})).toContain('no description');
  });
});

describe('trimToInterrupt', () => {
  /**
   * The caller only heard the words spoken before they cut in. Leaving the full
   * reply in history conditions the model on sentences the caller never heard,
   * which is how an interrupted agent answers a question nobody asked.
   */
  it('shortens the last assistant turn to what was actually heard', () => {
    const history = [
      { role: 'user' as const, content: 'hi' },
      { role: 'assistant' as const, content: 'Twilio has three products. First, Messaging.' },
    ];
    expect(trimToInterrupt(history, 'Twilio has three products')).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Twilio has three products' },
    ]);
  });

  it('leaves history alone when nothing was reported as heard', () => {
    const history = [{ role: 'assistant' as const, content: 'full reply' }];
    expect(trimToInterrupt(history, '')).toEqual(history);
  });

  it('leaves history alone when the last turn was the caller, not the agent', () => {
    const history = [{ role: 'user' as const, content: 'hi' }];
    expect(trimToInterrupt(history, 'hi')).toEqual(history);
  });
});

describe('SentinelSafeStream', () => {
  /**
   * Streaming is what fixes the slow turn-taking: TTS starts on the first
   * sentence instead of the last token. The hazard it introduces is that tool
   * sentinels are plain text in the stream — flush `[[end_` and the caller hears
   * the agent read out its own tool call.
   */
  it('flushes a completed sentence without waiting for the rest', () => {
    const stream = new SentinelSafeStream();
    expect(stream.push('Hello there. ')).toBe('Hello there. ');
  });

  it('holds a partial sentence back rather than speaking a fragment', () => {
    const stream = new SentinelSafeStream();
    expect(stream.push('Hello')).toBe('');
    expect(stream.push(' there. ')).toBe('Hello there. ');
  });

  it('never speaks a sentinel, even split across chunks', () => {
    const stream = new SentinelSafeStream();
    const spoken = ['Sure thing. ', '[[end', '_call]]'].map((c) => stream.push(c)).join('');
    expect(spoken + stream.flush()).toBe('Sure thing. ');
  });

  /** A stray `[[` that never becomes a sentinel must still reach the caller —
   *  holding it back forever would swallow the end of the sentence. */
  it('releases a bracket run that turns out not to be a sentinel', () => {
    const stream = new SentinelSafeStream();
    stream.push('Two things: ');
    stream.push('[[not a tool]] and more. ');
    expect(stream.text()).toContain('[[not a tool]] and more.');
  });

  it('reports the whole reply, sentinels included, for tool extraction', () => {
    const stream = new SentinelSafeStream();
    stream.push('Bye. [[end_call]]');
    stream.flush();
    expect(stream.text()).toBe('Bye. [[end_call]]');
  });
});

describe('turnTail', () => {
  /**
   * Twilio needs a `last: true` to close the turn, and an empty one is legal
   * only because something was already spoken. When the model produced nothing
   * at all, an empty final token is a silent turn — the caller hears the
   * greeting, asks a question, and gets nothing back.
   */
  it('is the remaining text when the turn already spoke', () => {
    expect(turnTail(true, 'and finally, this.', 'fallback')).toBe('and finally, this.');
  });

  it('is allowed to be empty once the reply has been spoken in full', () => {
    expect(turnTail(true, '', 'fallback')).toBe('');
  });

  it('speaks the fallback rather than nothing when the model produced no words', () => {
    expect(turnTail(false, '', 'Sorry, could you say that again?')).toBe(
      'Sorry, could you say that again?'
    );
  });
});
