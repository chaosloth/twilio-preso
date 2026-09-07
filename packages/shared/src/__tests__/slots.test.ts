import { describe, expect, test } from 'vitest';
import { resolveDeck } from '../deck.js';
import { STAGE_LIBRARY } from '../stageLibrary.js';
import type { Deck } from '../deck.js';

/**
 * Slot resolution is what makes a slide's on-screen copy and images editable
 * without forking the stage component. It follows the deck's existing override
 * rule — `undefined` inherits the template default, explicit `null` clears the
 * slot so the element is hidden — and the presenter reads only the resolved map.
 */
function deckOf(stageId: string, slots?: Record<string, string | null>): Deck {
  return { id: 'test', name: 'test', stages: [{ stageId, slots }] };
}

/** A library stage that declares slots, so these tests move with the library. */
const slotted = Object.values(STAGE_LIBRARY).find((t) => t.slots && t.slots.length > 0);

describe('resolveDeck slot resolution', () => {
  test('a template that declares slots resolves them to their defaults', () => {
    if (!slotted) throw new Error('no library stage declares slots');
    const [stage] = resolveDeck(deckOf(slotted.id));
    for (const def of slotted.slots!) {
      expect(stage.slots?.[def.key]).toBe(def.default);
    }
  });

  test('an override replaces the default', () => {
    if (!slotted) throw new Error('no library stage declares slots');
    const key = slotted.slots![0].key;
    const [stage] = resolveDeck(deckOf(slotted.id, { [key]: 'Edited on stage' }));
    expect(stage.slots?.[key]).toBe('Edited on stage');
  });

  test('an explicit null clears the slot rather than inheriting', () => {
    if (!slotted) throw new Error('no library stage declares slots');
    const key = slotted.slots![0].key;
    const [stage] = resolveDeck(deckOf(slotted.id, { [key]: null }));
    expect(stage.slots?.[key]).toBe('');
  });

  test('an override for a slot the template does not declare is ignored', () => {
    if (!slotted) throw new Error('no library stage declares slots');
    const [stage] = resolveDeck(deckOf(slotted.id, { 'not-a-slot': 'x' }));
    expect(stage.slots).not.toHaveProperty('not-a-slot');
  });

  test('a template with no slots resolves without a slots map at all', () => {
    const plain = Object.values(STAGE_LIBRARY).find((t) => !t.slots);
    if (!plain) return;
    const [stage] = resolveDeck(deckOf(plain.id));
    expect(stage.slots).toBeUndefined();
  });
});
