import { describe, expect, test } from 'vitest';
import { resolveDeck, type Deck } from '../deck.js';
import { STAGE_LIBRARY } from '../stageLibrary.js';

const deckOf = (...stages: Deck['stages']): Deck => ({ id: 't', name: 't', stages });

describe('override semantics', () => {
  test('omitted title inherits from the template', () => {
    const [stage] = resolveDeck(deckOf({ stageId: 'memory' }));
    expect(stage.title).toBe(STAGE_LIBRARY.memory.title);
  });

  test('explicit title replaces the template title', () => {
    const [stage] = resolveDeck(deckOf({ stageId: 'memory', title: 'Recall' }));
    expect(stage.title).toBe('Recall');
  });

  test('omitted demoTrigger inherits from the template', () => {
    const [stage] = resolveDeck(deckOf({ stageId: 'mass-call' }));
    expect(stage.demoTrigger).toBe('voice-mass-outbound');
  });

  test('null demoTrigger disables the trigger but keeps the slide', () => {
    const resolved = resolveDeck(deckOf({ stageId: 'mass-call', demoTrigger: null }));
    expect(resolved).toHaveLength(1);
    expect(resolved[0].demoTrigger).toBeUndefined();
  });

  test('null interaction disables the audience prompt but keeps the slide', () => {
    const [stage] = resolveDeck(deckOf({ stageId: 'patience-poll', interaction: null }));
    expect(stage.interaction).toBeNull();
  });

  test('omitted interaction inherits the template prompt', () => {
    const [stage] = resolveDeck(deckOf({ stageId: 'patience-poll' }));
    expect(stage.interaction?.prompt).toBe(STAGE_LIBRARY['patience-poll'].interaction?.prompt);
  });
});

describe('reordering and duplication', () => {
  test('index reflects deck position, not library position', () => {
    const resolved = resolveDeck(deckOf({ stageId: 'closing' }, { stageId: 'opening' }));
    expect(resolved.map((s) => [s.id, s.index])).toEqual([
      ['closing', 0],
      ['opening', 1],
    ]);
  });

  test('a stage may appear twice, each instance stamped with its own index', () => {
    const resolved = resolveDeck(deckOf({ stageId: 'siloes' }, { stageId: 'siloes' }));
    expect(resolved.map((s) => s.index)).toEqual([0, 1]);
    expect(resolved.every((s) => s.id === 'siloes')).toBe(true);
  });

  test('an unknown stage id is skipped without disturbing surrounding indices', () => {
    const resolved = resolveDeck(deckOf({ stageId: 'opening' }, { stageId: 'nope' }, { stageId: 'closing' }));
    expect(resolved.map((s) => [s.id, s.index])).toEqual([
      ['opening', 0],
      ['closing', 1],
    ]);
  });
});
