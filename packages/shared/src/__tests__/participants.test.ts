import { describe, expect, test } from 'vitest';
import { DEFAULT_DECK, resolveDeck, type Deck } from '../deck.js';
import { answeredQuestions, responseFor } from '../participants.js';
import { STAGE_LIBRARY } from '../stageLibrary.js';
import type { Participant, ParticipantResponse } from '../types.js';

const response = (stageId: string, value: string, over: Partial<ParticipantResponse> = {}): ParticipantResponse => ({
  stageId,
  stageIndex: 0,
  type: 'text',
  value,
  timestamp: 0,
  ...over,
});

const participantWith = (...responses: ParticipantResponse[]): Participant => ({
  id: 'p1',
  name: 'Ada',
  phone: '+61400000000',
  registeredAt: 0,
  responses: Object.fromEntries(responses.map((r) => [r.stageId, r])),
});

const deckOf = (...stageIds: string[]): Deck => ({
  id: 't',
  name: 't',
  stages: stageIds.map((stageId) => ({ stageId })),
});

describe('responseFor', () => {
  test('finds a response by stage id', () => {
    const p = participantWith(response('customers-are', 'latency'));
    expect(responseFor(p, 'customers-are')?.value).toBe('latency');
  });

  test('returns undefined for a stage the participant did not answer', () => {
    const p = participantWith(response('customers-are', 'latency'));
    expect(responseFor(p, 'innovation')).toBeUndefined();
  });

  test('tolerates a participant with no responses at all', () => {
    const p = participantWith();
    expect(responseFor(p, 'customers-are')).toBeUndefined();
  });

  test('tolerates a null participant', () => {
    expect(responseFor(null, 'customers-are')).toBeUndefined();
  });

  test('finds the answer regardless of where the stage sits in the deck', () => {
    // The whole point of re-keying: the old code searched for stageIndex === 10.
    const p = participantWith(response('customers-are', 'latency'));
    const reordered = resolveDeck(deckOf('closing', 'customers-are'));
    expect(reordered.find((s) => s.id === 'customers-are')?.index).toBe(1);
    expect(responseFor(p, 'customers-are')?.value).toBe('latency');
  });
});

describe('answeredQuestions', () => {
  const stages = resolveDeck(DEFAULT_DECK);

  test('pairs each answer with the question that was asked', () => {
    const p = participantWith(response('customers-are', 'latency'));
    expect(answeredQuestions(p, stages)).toEqual([
      {
        stageId: 'customers-are',
        question: STAGE_LIBRARY['customers-are'].interaction?.prompt,
        answer: 'latency',
      },
    ]);
  });

  test('orders answers by deck position, not by insertion order', () => {
    const p = participantWith(
      response('innovation', 'AWS', { type: 'poll' }),
      response('patience-poll', 'A lot', { type: 'poll' }),
    );
    expect(answeredQuestions(p, stages).map((a) => a.stageId)).toEqual([
      'patience-poll',
      'innovation',
    ]);
  });

  test('reordering the deck reorders the answers', () => {
    const p = participantWith(
      response('innovation', 'AWS', { type: 'poll' }),
      response('patience-poll', 'A lot', { type: 'poll' }),
    );
    const reordered = resolveDeck(deckOf('innovation', 'patience-poll'));
    expect(answeredQuestions(p, reordered).map((a) => a.stageId)).toEqual([
      'innovation',
      'patience-poll',
    ]);
  });

  test('excludes llm-prompt answers, which are conversation not context', () => {
    const p = participantWith(
      response('ai-playground', 'What is Twilio?', { type: 'llm-prompt' }),
      response('customers-are', 'latency'),
    );
    expect(answeredQuestions(p, stages).map((a) => a.stageId)).toEqual(['customers-are']);
  });

  test('excludes blank answers', () => {
    const p = participantWith(response('customers-are', ''));
    expect(answeredQuestions(p, stages)).toEqual([]);
  });

  test('excludes answers for stages this deck does not show', () => {
    // A deck without the word cloud never asked the question, so its answer
    // must not be presented as something the audience member told us here.
    const p = participantWith(response('customers-are', 'latency'));
    expect(answeredQuestions(p, resolveDeck(deckOf('opening', 'closing')))).toEqual([]);
  });

  test('a stage shown twice yields one answer, not two', () => {
    const p = participantWith(response('customers-are', 'latency'));
    const duplicated = resolveDeck(deckOf('customers-are', 'customers-are'));
    expect(answeredQuestions(p, duplicated)).toHaveLength(1);
  });

  test('a stage with no interaction reports a null question', () => {
    // Possible if a trigger stage records something against itself.
    const p = participantWith(response('siloes', 'noted'));
    expect(answeredQuestions(p, stages)).toEqual([
      { stageId: 'siloes', question: null, answer: 'noted' },
    ]);
  });

  test('returns empty for a null participant', () => {
    expect(answeredQuestions(null, stages)).toEqual([]);
  });
});
