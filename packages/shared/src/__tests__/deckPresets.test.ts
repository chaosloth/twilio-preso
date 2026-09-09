import { describe, expect, it } from 'vitest';
import { DECK_PRESETS, SCAN_AND_VOTE_DECK, deckPreset } from '../deckPresets.js';
import { DEFAULT_DECK, resolveDeck } from '../deck.js';
import { validateDeck } from '../validateDeck.js';

describe('deck presets', () => {
  it('offers the full deck as well as the short one', () => {
    expect(DECK_PRESETS.map((p) => p.deck.id)).toContain(DEFAULT_DECK.id);
    expect(deckPreset(SCAN_AND_VOTE_DECK.id)?.deck).toBe(SCAN_AND_VOTE_DECK);
    expect(deckPreset('nothing-like-this')).toBeUndefined();
  });
});

describe('scan and vote deck', () => {
  const stages = resolveDeck(SCAN_AND_VOTE_DECK);

  it('is the QR slide and the three choices, in that order', () => {
    expect(stages.map((s) => s.id)).toEqual(['opening', 'brand-poll', 'theme-poll', 'otp-poll']);
  });

  /** "Scan me" and nothing else: the QR is the whole slide, so no image, no
   *  sub-headline competing with it. */
  it('shows nothing on the opening slide but the code and scan me', () => {
    const opening = stages[0];
    expect(opening.slots?.headline).toMatch(/scan me/i);
    expect(opening.slots?.image).toBe('');
    expect(opening.slots?.subhead).toBe('');
  });

  it('asks each question with both answers on the phones', () => {
    expect(stages[1].interaction?.options).toEqual(['Cup Cakes Store', 'Guided Tour Package']);
    expect(stages[2].interaction?.options).toEqual(['Modern Sunset (Red)', 'Nordic Forest (Green)']);
    expect(stages[3].interaction?.options).toEqual(['SMS/RCS', 'WhatsApp']);
  });

  /** A deck with a warning is one a presenter has to reason about mid-preparation
   *  — a shipped preset should have none. */
  it('carries no deck warnings', () => {
    expect(validateDeck(SCAN_AND_VOTE_DECK)).toEqual([]);
  });
});
