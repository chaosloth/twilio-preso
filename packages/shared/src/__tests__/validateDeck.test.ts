import { describe, expect, test } from 'vitest';
import { DEFAULT_DECK, type Deck } from '../deck.js';
import { validateDeck } from '../validateDeck.js';

const deckOf = (...stages: Deck['stages']): Deck => ({ id: 't', name: 't', stages });
const codes = (deck: Deck, opts?: { hasModelAccess?: boolean }) =>
  validateDeck(deck, opts).map((w) => w.code);

describe('validateDeck', () => {
  test('the default deck with model access configured is clean', () => {
    expect(validateDeck(DEFAULT_DECK, { hasModelAccess: true })).toEqual([]);
  });

  test('warns when a trigger depends on a stage the deck omits', () => {
    // 'memory' fires the personalised SMS built from the 'customers-are' word cloud.
    const warnings = validateDeck(deckOf({ stageId: 'memory' }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: 'missing-dependency',
      stageId: 'memory',
      stageIndex: 0,
      dependsOn: 'customers-are',
    });
  });

  test('no dependency warning once the depended-on stage is present', () => {
    expect(codes(deckOf({ stageId: 'customers-are' }, { stageId: 'memory' }))).not.toContain(
      'missing-dependency',
    );
  });

  test('a dependency satisfied only after the trigger still warns', () => {
    // The word cloud must be collected before the SMS reads it.
    const warnings = validateDeck(deckOf({ stageId: 'memory' }, { stageId: 'customers-are' }));
    expect(warnings.map((w) => w.code)).toContain('dependency-after-trigger');
  });

  test('no dependency warning when the trigger is disabled', () => {
    expect(codes(deckOf({ stageId: 'memory', demoTrigger: null }))).not.toContain(
      'missing-dependency',
    );
  });

  test('warns on an unknown stage id', () => {
    const warnings = validateDeck(deckOf({ stageId: 'not-a-stage' }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: 'unknown-stage',
      stageId: 'not-a-stage',
      stageIndex: 0,
    });
  });

  test('warns on an llm-prompt stage when model access is not configured', () => {
    expect(codes(deckOf({ stageId: 'ai-playground' }), { hasModelAccess: false })).toEqual([
      'no-model-access',
    ]);
  });

  test('no model warning when the llm-prompt interaction is disabled', () => {
    expect(
      codes(deckOf({ stageId: 'ai-playground', interaction: null }), { hasModelAccess: false }),
    ).toEqual([]);
  });

  test('model access is only assumed unconfigured when explicitly stated', () => {
    // Callers without env visibility (the presenter HUD) pass nothing and must
    // not be told the model is missing.
    expect(codes(deckOf({ stageId: 'ai-playground' }))).toEqual([]);
  });

  test('reports every warning rather than stopping at the first', () => {
    const warnings = validateDeck(deckOf({ stageId: 'nope' }, { stageId: 'memory' }));
    expect(warnings.map((w) => w.code).sort()).toEqual(['missing-dependency', 'unknown-stage']);
  });

  test('every warning carries a human-readable message for the HUD', () => {
    const warnings = validateDeck(deckOf({ stageId: 'nope' }, { stageId: 'memory' }));
    expect(warnings.every((w) => typeof w.message === 'string' && w.message.length > 0)).toBe(true);
  });
});
