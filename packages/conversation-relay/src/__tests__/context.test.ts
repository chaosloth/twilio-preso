import { describe, expect, it } from 'vitest';
import { resolveRelayConfig, tallyRoom } from '@twilio-preso/shared';
import type { Participant } from '@twilio-preso/shared';
import { buildCallerContext, systemPromptFor } from '../llm.js';

function attendee(id: string, answers: Record<string, string>): Participant {
  return {
    id,
    name: id === 'a' ? 'Billy' : id,
    phone: `+6140000000${id.charCodeAt(0)}`,
    registeredAt: 0,
    responses: Object.fromEntries(
      Object.entries(answers).map(([stageId, value]) => [
        stageId,
        { stageId, stageIndex: 0, type: 'poll' as const, value, timestamp: 0 },
      ])
    ),
  };
}

/** The room builds a cupcake store; this caller voted for the guided tour. */
const room = tallyRoom([
  attendee('a', { 'brand-poll': 'Guided Tour Package', 'theme-poll': 'Modern Sunset (Red)' }),
  attendee('b', { 'brand-poll': 'Cup Cakes Store', 'theme-poll': 'Modern Sunset (Red)' }),
  attendee('c', { 'brand-poll': 'Cup Cakes Store', 'theme-poll': 'Modern Sunset (Red)' }),
]);

const caller = attendee('a', { 'brand-poll': 'Guided Tour Package', 'theme-poll': 'Modern Sunset (Red)' });

const promptWith = (overrides = {}, tallies = room) =>
  systemPromptFor(buildCallerContext(caller, null, true, tallies), resolveRelayConfig(overrides));

describe('room context in the prompt', () => {
  it('tells the agent what the room chose, with the numbers behind it', () => {
    const prompt = promptWith();
    expect(prompt).toContain('Which brand are we building today?');
    expect(prompt).toContain('Cup Cakes Store');
    expect(prompt).toMatch(/2 of 3/);
  });

  /** The whole point: what got built follows the room, and the caller's own
   *  answer may have lost. An agent that cannot tell those apart congratulates
   *  someone on a decision they voted against. */
  it('marks the question where the caller and the room disagreed', () => {
    expect(promptWith()).toMatch(/they (chose|answered|picked)[^\n]*Guided Tour Package/i);
    expect(promptWith()).toMatch(/differ|not what they|voted against|their own choice/i);
  });

  it('says the room was split rather than naming a winner a tie produced', () => {
    const split = tallyRoom([
      attendee('a', { 'brand-poll': 'Cup Cakes Store' }),
      attendee('b', { 'brand-poll': 'Guided Tour Package' }),
    ]);
    expect(promptWith({}, split)).toMatch(/split|tie/i);
  });

  it('asks the agent to say what was built from those answers', () => {
    expect(promptWith()).toContain(resolveRelayConfig().outcomeInstruction);
  });

  /** Off is a demo choice — the agent working from one person's answers alone —
   *  and it must take the room's block away with it, not just the instruction. */
  it('leaves the room out entirely when the session turns it off', () => {
    const prompt = promptWith({ roomContext: false });
    expect(prompt).not.toContain('Cup Cakes Store');
    expect(prompt).not.toContain(resolveRelayConfig().outcomeInstruction);
  });

  it('says nothing about the room when nobody has answered yet', () => {
    const prompt = promptWith({}, []);
    expect(prompt).not.toContain(resolveRelayConfig().outcomeInstruction);
  });
});
