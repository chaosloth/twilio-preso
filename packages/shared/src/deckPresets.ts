import { DEFAULT_DECK } from './deck.js';
import type { Deck } from './deck.js';

/**
 * The four-slide deck: scan the code, then choose the brand, the palette and the
 * passcode channel.
 *
 * It is the whole talk reduced to what the rest of the demo is built on — the
 * three mandatory polls decide what gets built, and the voice agent's room
 * context reads their tallies — so this is the deck to give when there is time
 * for the choices and the finale but not the middle of the talk.
 *
 * The opening slide is overridden rather than re-templated: the QR code is the
 * slide, so the image slot stays empty and the sub-headline is cleared instead
 * of competing with it for attention.
 */
export const SCAN_AND_VOTE_DECK: Deck = {
  id: 'scan-and-vote',
  name: 'Scan & vote — QR plus the three choices',
  stages: [
    { stageId: 'opening', slots: { headline: 'Scan Me', subhead: '', image: '' } },
    { stageId: 'brand-poll' },
    { stageId: 'theme-poll' },
    { stageId: 'otp-poll' },
  ],
};

/** A deck a presenter can start a session from, named for the picker. */
export interface DeckPreset {
  id: string;
  label: string;
  /** What it is for, one line, shown under the picker. */
  description: string;
  deck: Deck;
}

/**
 * What `POST /api/sessions` may be given as a starting deck. A session's deck is
 * a snapshot from the moment it was created, so a preset is a starting point and
 * never a live reference — editing one here cannot change a running event.
 */
export const DECK_PRESETS: readonly DeckPreset[] = [
  {
    id: DEFAULT_DECK.id,
    label: 'Full deck',
    description: 'Every stage, in library order — the complete talk.',
    deck: DEFAULT_DECK,
  },
  {
    id: SCAN_AND_VOTE_DECK.id,
    label: 'Scan & vote',
    description: 'QR registration, then the brand, theme and passcode polls.',
    deck: SCAN_AND_VOTE_DECK,
  },
];

export function deckPreset(id: string): DeckPreset | undefined {
  return DECK_PRESETS.find((p) => p.id === id);
}
