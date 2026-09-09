import { describe, expect, it } from 'vitest';
import {
  historyFromCommunications,
  inboundText,
} from '../orchestratorEvents.js';
import type { OrchestratorEvent } from '../orchestratorEvents.js';

const POOL = '+61400111222';

function event(overrides: Record<string, any> = {}): OrchestratorEvent {
  return {
    eventType: 'COMMUNICATION_CREATED',
    data: {
      id: 'CM1',
      conversationId: 'CV1',
      author: { address: '+61499000111', channel: 'SMS' },
      content: { type: 'TEXT', text: 'what did the room pick?' },
      recipients: [{ address: POOL, channel: 'SMS' }],
      ...overrides,
    },
  } as OrchestratorEvent;
}

describe('inboundText', () => {
  it('reads the sender, our number and the channel off a normal SMS event', () => {
    expect(inboundText(event(), [POOL])).toEqual({
      conversationId: 'CV1',
      from: '+61499000111',
      poolNumber: POOL,
      channel: 'sms',
      text: 'what did the room pick?',
    });
  });

  it('strips the whatsapp: prefix so the number matches a participant record', () => {
    const result = inboundText(
      event({
        author: { address: 'whatsapp:+61499000111', channel: 'WHATSAPP' },
        recipients: [{ address: `whatsapp:${POOL}`, channel: 'WHATSAPP' }],
      }),
      [POOL]
    );
    expect(result).toMatchObject({ from: '+61499000111', poolNumber: POOL, channel: 'whatsapp' });
  });

  /**
   * The capture rules are bidirectional, so the reply this app sends is itself
   * captured and arrives back as a COMMUNICATION_CREATED authored by the pool
   * number. Without this the agent answers itself until the number is throttled.
   */
  it('ignores a message our own number sent, which is how the loop is broken', () => {
    expect(
      inboundText(event({ author: { address: POOL, channel: 'SMS' } }), [POOL])
    ).toBeNull();
  });

  it('ignores delivery-status churn and anything that is not new text', () => {
    expect(inboundText({ ...event(), eventType: 'COMMUNICATION_UPDATED' } as OrchestratorEvent, [POOL])).toBeNull();
    expect(inboundText(event({ content: { type: 'MEDIA', text: '' } }), [POOL])).toBeNull();
    expect(inboundText(event({ content: { type: 'TEXT', text: '   ' } }), [POOL])).toBeNull();
  });

  /** Voice is ConversationRelay's, and this app declares no voice capture rules —
   *  but an event arriving anyway must not be answered with a text message. */
  it('ignores a voice communication', () => {
    expect(
      inboundText(
        event({
          author: { address: '+61499000111', channel: 'VOICE' },
          recipients: [{ address: POOL, channel: 'VOICE' }],
        }),
        [POOL]
      )
    ).toBeNull();
  });

  it('ignores a message addressed to a number this deployment does not own', () => {
    expect(inboundText(event(), ['+61400999888'])).toBeNull();
  });
});

describe('historyFromCommunications', () => {
  it('reads our own messages as the assistant and everyone else as the user', () => {
    const history = historyFromCommunications(
      [
        { author: '+61499000111', text: 'hi' },
        { author: POOL, text: 'Hi Ada!' },
        { author: 'whatsapp:+61499000111', text: 'what did we build?' },
      ].map((c) => ({
        author: { address: c.author },
        content: { type: 'TEXT', text: c.text },
      })) as never,
      POOL
    );
    expect(history).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Hi Ada!' },
      { role: 'user', content: 'what did we build?' },
    ]);
  });

  it('drops anything without text and keeps only the last few turns', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      author: { address: '+61499000111' },
      content: { type: 'TEXT', text: `m${i}` },
    }));
    many.push({ author: { address: '+61499000111' }, content: { type: 'MEDIA', text: '' } } as never);
    const history = historyFromCommunications(many as never, POOL);
    expect(history.length).toBeLessThanOrEqual(12);
    expect(history.at(-1)).toEqual({ role: 'user', content: 'm39' });
  });

  it('counts our replies, so a thread can be capped without a second store', () => {
    const history = historyFromCommunications(
      [
        { author: { address: POOL }, content: { type: 'TEXT', text: 'a' } },
        { author: { address: POOL }, content: { type: 'TEXT', text: 'b' } },
      ] as never,
      POOL
    );
    expect(history.filter((h) => h.role === 'assistant')).toHaveLength(2);
  });
});
