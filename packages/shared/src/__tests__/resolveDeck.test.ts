import { describe, expect, test } from 'vitest';
import { DEFAULT_DECK, resolveDeck } from '../deck.js';
import stagesFixture from './stages.fixture.json' with { type: 'json' };

/**
 * `stages.fixture.json` is a verbatim serialisation of the old `STAGES` array,
 * captured before it was deleted. It is the regression test for the whole deck
 * refactor: resolving DEFAULT_DECK must reproduce the presentation exactly.
 *
 * One intentional schema change stands between the two shapes — the spec drops
 * `InteractionConfig.stageIndex` (a second source of truth for array position)
 * in favour of `stageId`. That migration is applied here, in the open, rather
 * than baked into the fixture, so the fixture stays an honest record of what
 * shipped and the one permitted difference is visible in the test.
 */
function migrateFixtureStage(stage: Record<string, unknown>) {
  const interaction = stage.interaction as Record<string, unknown> | null;
  if (!interaction) return stage;
  const { stageIndex: _dropped, ...rest } = interaction;
  return { ...stage, interaction: { stageId: stage.id, ...rest } };
}

const expectedStages = (stagesFixture as Record<string, unknown>[]).map(migrateFixtureStage);

describe('resolveDeck(DEFAULT_DECK)', () => {
  test('reproduces the 23 stages the presentation shipped with', () => {
    expect(resolveDeck(DEFAULT_DECK)).toEqual(expectedStages);
  });

  test('stamps a runtime index matching array position', () => {
    const resolved = resolveDeck(DEFAULT_DECK);
    resolved.forEach((stage, i) => expect(stage.index).toBe(i));
  });
});
