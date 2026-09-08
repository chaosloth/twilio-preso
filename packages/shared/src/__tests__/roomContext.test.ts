import { describe, expect, it } from 'vitest';
import { tallyRoom, winnerFor } from '../roomContext.js';
import { STAGE_LIBRARY } from '../stageLibrary.js';
import type { Participant } from '../types.js';

/** A participant who answered the stages given, nothing more. */
function attendee(id: string, answers: Record<string, string>): Participant {
  return {
    id,
    name: id,
    phone: `+6100000000${id}`,
    registeredAt: 0,
    responses: Object.fromEntries(
      Object.entries(answers).map(([stageId, value]) => [
        stageId,
        // The stage's real interaction type: whether an answer counts towards a
        // collective choice is decided by the type, so faking them all as polls
        // would test something the app never sends.
        { stageId, stageIndex: 0, type: STAGE_LIBRARY[stageId]?.interaction?.type ?? 'poll', value, timestamp: 0 },
      ])
    ),
  };
}

describe('tallyRoom', () => {
  it('finds the option the room actually chose, not the one any individual did', () => {
    const room = tallyRoom([
      attendee('a', { 'brand-poll': 'Cup Cakes Store' }),
      attendee('b', { 'brand-poll': 'Cup Cakes Store' }),
      attendee('c', { 'brand-poll': 'Guided Tour Package' }),
    ]);

    const brand = winnerFor(room, 'brand-poll');
    expect(brand?.winner).toBe('Cup Cakes Store');
    expect(brand?.winnerCount).toBe(2);
    expect(brand?.total).toBe(3);
    expect(brand?.tie).toBe(false);
    expect(brand?.question).toBe('Which brand are we building today?');
  });

  /** The finale has to say *something*, and "it was split" is the honest thing
   *  to say — a silent coin-toss presented as a decision is worse. */
  it('reports a dead heat as a tie rather than picking the first option', () => {
    const room = tallyRoom([
      attendee('a', { 'theme-poll': 'Modern Sunset (Red)' }),
      attendee('b', { 'theme-poll': 'Nordic Forest (Green)' }),
    ]);
    expect(winnerFor(room, 'theme-poll')?.tie).toBe(true);
  });

  /** Free text is not an option list: "Waiting" and "waiting" are one answer,
   *  and counting them apart is how a clear majority looks like a three-way
   *  split. The spelling the room used first is the one reported. */
  it('folds free-text answers that differ only in case or spacing', () => {
    const room = tallyRoom([
      attendee('a', { 'customers-are': 'Waiting' }),
      attendee('b', { 'customers-are': ' waiting ' }),
      attendee('c', { 'customers-are': 'silos' }),
    ]);
    const word = winnerFor(room, 'customers-are');
    expect(word?.winner).toBe('Waiting');
    expect(word?.winnerCount).toBe(2);
  });

  it('ignores unanswered stages and the AI-prompt conversation', () => {
    const room = tallyRoom([
      attendee('a', { 'brand-poll': '', 'ai-playground': 'what is Twilio Sync?' }),
    ]);
    expect(room).toEqual([]);
  });

  /** Ordered so the prompt reads as the talk ran, rather than by whichever
   *  stage the first attendee happened to answer first. */
  it('orders the tallies the way the stage library does', () => {
    const room = tallyRoom([
      attendee('a', { 'innovation': 'AWS', 'brand-poll': 'Cup Cakes Store', 'theme-poll': 'Modern Sunset (Red)' }),
    ]);
    expect(room.map((t) => t.stageId)).toEqual(['brand-poll', 'theme-poll', 'innovation']);
  });

  it('counts every option, not only the winner', () => {
    const room = tallyRoom([
      attendee('a', { 'brand-poll': 'Cup Cakes Store' }),
      attendee('b', { 'brand-poll': 'Guided Tour Package' }),
      attendee('c', { 'brand-poll': 'Cup Cakes Store' }),
    ]);
    expect(winnerFor(room, 'brand-poll')?.counts).toEqual([
      { value: 'Cup Cakes Store', count: 2 },
      { value: 'Guided Tour Package', count: 1 },
    ]);
  });
});
