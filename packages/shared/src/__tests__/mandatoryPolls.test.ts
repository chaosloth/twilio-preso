import { describe, expect, test } from 'vitest';
import { DEFAULT_DECK, resolveDeck } from '../deck.js';
import { MANDATORY_POLL_STAGE_IDS, STAGE_LIBRARY } from '../stageLibrary.js';

/**
 * Three polls the presentation always asks: they choose the brand, the theme and
 * the OTP channel every later slide and every outbound message is built around.
 * Their answers are the ones written to the attendee's `live-presentation` trait
 * group, so their ids and their options are a contract, not copy.
 */
describe('mandatory polls', () => {
  test('every mandatory poll id exists in the library', () => {
    for (const id of MANDATORY_POLL_STAGE_IDS) {
      expect(STAGE_LIBRARY[id], id).toBeDefined();
    }
  });

  test('each one is a poll whose interaction is keyed to its own stage', () => {
    for (const id of MANDATORY_POLL_STAGE_IDS) {
      const interaction = STAGE_LIBRARY[id].interaction;
      expect(interaction?.type, id).toBe('poll');
      expect(interaction?.stageId, id).toBe(id);
      expect(interaction?.options?.length, id).toBe(2);
    }
  });

  test('offers the brand, theme and OTP options the talk is built around', () => {
    expect(STAGE_LIBRARY['brand-poll'].interaction?.options).toEqual([
      'Cup Cakes Store',
      'Guided Tour Package',
    ]);
    expect(STAGE_LIBRARY['theme-poll'].interaction?.options).toEqual([
      'Modern Sunset (Red)',
      'Nordic Forest (Green)',
    ]);
    expect(STAGE_LIBRARY['otp-poll'].interaction?.options).toEqual(['SMS/RCS', 'WhatsApp']);
  });

  test('all three are in the default deck, in order, before any other interaction', () => {
    const resolved = resolveDeck(DEFAULT_DECK);
    const positions = MANDATORY_POLL_STAGE_IDS.map((id) => resolved.findIndex((s) => s.id === id));
    expect(positions.some((p) => p < 0)).toBe(false);
    expect([...positions]).toEqual([...positions].sort((a, b) => a - b));

    const firstOther = resolved.findIndex(
      (s) => s.interaction && !MANDATORY_POLL_STAGE_IDS.includes(s.id)
    );
    if (firstOther >= 0) expect(Math.max(...positions)).toBeLessThan(firstOther);
  });
});
