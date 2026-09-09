import { describe, expect, it } from 'vitest';
import { buildCallerContext, hasContext, systemPromptFor } from '../agentContext.js';
import { DEFAULT_RELAY_CONFIG, TEXT_MEDIUM_RULE, resolveRelayConfig } from '../relayConfig.js';
import type { CallerContext } from '../agentContext.js';
import type { Participant } from '../types.js';

const participant = {
  id: 'p1',
  name: 'Ada',
  phone: '+61400000000',
  company: 'Twilio',
  role: 'engineer',
  joinedAt: '',
  responses: {
    'brand-poll': { stageId: 'brand-poll', type: 'poll', value: 'Twilio Tours', at: '' },
  },
} as unknown as Participant;

const room = [
  {
    stageId: 'brand-poll',
    question: 'What should we build?',
    counts: [
      { value: 'Twilio Cup Cakes', count: 7 },
      { value: 'Twilio Tours', count: 2 },
    ],
    winner: 'Twilio Cup Cakes',
    winnerCount: 7,
    total: 9,
    tie: false,
  },
];

function ctx(overrides: Partial<CallerContext> = {}): CallerContext {
  return { ...buildCallerContext(participant, null, true, room), ...overrides };
}

describe('buildCallerContext', () => {
  it('reads the name, company and this session answers off the participant', () => {
    const c = buildCallerContext(participant, null, true);
    expect(c.name).toBe('Ada');
    expect(c.company).toBe('Twilio');
    expect(c.answers.map((a) => a.answer)).toEqual(['Twilio Tours']);
    expect(hasContext(c)).toBe(true);
  });

  it('reads traits and observations off the durable profile when there is no participant', () => {
    const c = buildCallerContext(
      null,
      {
        traits: {
          Contact: { firstName: 'Grace', lastName: 'Hopper' },
          'live-presentation': { company: 'Navy', theme: 'Nordic Forest' },
        },
        observations: ['Asked about latency'],
      },
      false
    );
    expect(c.name).toBe('Grace Hopper');
    expect(c.company).toBe('Navy');
    expect(c.choices).toEqual([{ label: 'theme they chose', value: 'Nordic Forest' }]);
    expect(c.observations).toEqual(['Asked about latency']);
  });
});

describe('systemPromptFor', () => {
  it('states the room result with its counts and says when the caller differs', () => {
    const prompt = systemPromptFor(ctx(), DEFAULT_RELAY_CONFIG);
    expect(prompt).toContain('the room chose "Twilio Cup Cakes" (7 of 9)');
    expect(prompt).toContain('their own choice differs from the room\'s');
  });

  /**
   * The voice agent is live. Moving these functions into `shared` and adding a
   * medium must not change one byte of what a call is prompted with.
   */
  it('is unchanged for voice whether the medium is stated or omitted', () => {
    const c = ctx();
    expect(systemPromptFor(c, DEFAULT_RELAY_CONFIG, { medium: 'voice' })).toBe(
      systemPromptFor(c, DEFAULT_RELAY_CONFIG)
    );
    expect(systemPromptFor(c, DEFAULT_RELAY_CONFIG)).not.toContain(TEXT_MEDIUM_RULE);
  });

  it('tells a text agent it is writing, not speaking, and drops the call-only direction', () => {
    const prompt = systemPromptFor(ctx(), DEFAULT_RELAY_CONFIG, { medium: 'text' });
    expect(prompt).toContain(TEXT_MEDIUM_RULE);
    expect(prompt).not.toMatch(/stay on the line/i);
  });

  /** Sentinels are a voice-turn mechanism; the text path handles none of them, so
   *  a model told about them would emit a token nothing strips. */
  it('never offers a tool on text, even when the session enables one', () => {
    const config = resolveRelayConfig({ tools: [{ id: 'end_call', enabled: true }] });
    expect(systemPromptFor(ctx(), config, { medium: 'text' })).not.toContain('[[end_call]]');
    expect(systemPromptFor(ctx(), config)).toContain('[[end_call]]');
  });
});
