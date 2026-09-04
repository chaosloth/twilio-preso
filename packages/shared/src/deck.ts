import { STAGE_LIBRARY, STAGE_LIBRARY_ORDER } from './stageLibrary.js';
import type { DemoTriggerId } from './stageLibrary.js';
import type { InteractionConfig } from './types.js';

/**
 * One slide in a deck: a reference to a library stage, plus optional overrides.
 *
 * `undefined` inherits from the template; explicit `null` disables. The
 * distinction matters — a presenter who wants the deck intact but the mass
 * outbound call suppressed sets `demoTrigger: null` rather than deleting the
 * slide.
 */
export interface DeckStage {
  stageId: string;
  title?: string;
  notes?: string;
  interaction?: InteractionConfig | null;
  demoTrigger?: DemoTriggerId | null;
}

export interface Deck {
  id: string;
  name: string;
  stages: DeckStage[];
}

/**
 * A deck stage merged with its template and stamped with its runtime position.
 * This is what presenter, audience, and backend consume — nothing imports a
 * global stage array.
 *
 * Note the absence of `dependsOn`: that is validation metadata read from
 * STAGE_LIBRARY by validateDeck, not presentation data.
 */
export interface ResolvedStage {
  index: number;
  id: string;
  title: string;
  act: 1 | 2 | 3 | 4;
  notes: string;
  interaction: InteractionConfig | null;
  demoTrigger?: DemoTriggerId;
}

/** Today's presentation: every library stage, in library order, no overrides. */
export const DEFAULT_DECK: Deck = {
  id: 'default',
  name: 'Wonder — full deck',
  stages: STAGE_LIBRARY_ORDER.map((stageId) => ({ stageId })),
};

/**
 * Merge each deck stage with its template and stamp the runtime index.
 * Unknown stage ids are skipped — validateDeck reports them; resolution stays
 * total so one bad id cannot blank the presentation mid-event.
 */
export function resolveDeck(deck: Deck): ResolvedStage[] {
  const resolved: ResolvedStage[] = [];

  for (const deckStage of deck.stages) {
    const template = STAGE_LIBRARY[deckStage.stageId];
    if (!template) continue;

    const stage: ResolvedStage = {
      index: resolved.length,
      id: template.id,
      title: deckStage.title ?? template.title,
      act: template.act,
      notes: deckStage.notes ?? template.notes,
      interaction: deckStage.interaction === undefined ? template.interaction : deckStage.interaction,
    };

    const demoTrigger = deckStage.demoTrigger === undefined ? template.demoTrigger : deckStage.demoTrigger;
    if (demoTrigger) stage.demoTrigger = demoTrigger;

    resolved.push(stage);
  }

  return resolved;
}
