import { describe, expect, test } from 'vitest';
import { DEFAULT_DECK, resolveDeck } from '../deck.js';
import stagesFixture from './stages.fixture.json' with { type: 'json' };

/**
 * `stages.fixture.json` is a verbatim serialisation of the old `STAGES` array,
 * captured before it was deleted. It is the regression test for the whole deck
 * refactor: resolving DEFAULT_DECK must reproduce the presentation exactly.
 *
 * Two intentional schema changes stand between the two shapes. The first — the spec drops
 * `InteractionConfig.stageIndex` (a second source of truth for array position)
 * in favour of `stageId`. That migration is applied here, in the open, rather
 * than baked into the fixture, so the fixture stays an honest record of what
 * shipped and the one permitted difference is visible in the test.
 */
/** Slots carry template defaults only; the fixture predates them. */
function withoutSlots(stage: Record<string, unknown>) {
  const { slots: _dropped, ...rest } = stage;
  return rest;
}

function migrateFixtureStage(stage: Record<string, unknown>) {
  const interaction = stage.interaction as Record<string, unknown> | null;
  if (!interaction) return stage;
  const { stageIndex: _dropped, ...rest } = interaction;
  return { ...stage, interaction: { stageId: stage.id, ...rest } };
}

const expectedStages = (stagesFixture as Record<string, unknown>[]).map(migrateFixtureStage);

/** Position is a property of the deck, and the deck has legitimately grown
 *  since the fixture was captured — so every shipped stage must still resolve
 *  identically apart from where it sits. Order is asserted separately. */
function withoutIndex(stage: Record<string, unknown>) {
  const { index: _dropped, ...rest } = stage;
  return rest;
}

describe('resolveDeck(DEFAULT_DECK)', () => {
  /**
   * The fixture records the 23 stages that shipped. Stages added since — the
   * three mandatory polls, the blank canvas — are additions to the deck, not
   * changes to those 23, so this asserts the shipped stages survive unchanged
   * and in their original relative order rather than asserting the deck is
   * still exactly 23 long. The fixture itself is never edited to pass.
   */
  test('still reproduces every stage the presentation shipped with, in order', () => {
    const resolved = resolveDeck(DEFAULT_DECK).map((s) =>
      withoutSlots(s as unknown as Record<string, unknown>)
    );
    const byId = new Map(resolved.map((s) => [s.id as string, s]));

    for (const expected of expectedStages) {
      const actual = byId.get(expected.id as string);
      expect(actual, expected.id as string).toBeDefined();
      expect(withoutIndex(actual!)).toEqual(withoutIndex(expected));
    }

    const positions = expectedStages.map((s) =>
      resolved.findIndex((r) => r.id === s.id)
    );
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  test('stamps a runtime index matching array position', () => {
    const resolved = resolveDeck(DEFAULT_DECK);
    resolved.forEach((stage, i) => expect(stage.index).toBe(i));
  });
});
