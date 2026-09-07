import { STAGE_LIBRARY, STAGE_LIBRARY_ORDER } from './stageLibrary.js';
import type { DemoTriggerId, SlotDef } from './stageLibrary.js';
import type { InteractionConfig } from './types.js';
import type { CanvasElement } from './canvas.js';

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
  /**
   * Per-slot copy and image overrides, keyed by slot key. Same rule as above:
   * a missing key inherits the template default, an explicit `null` clears the
   * slot so the presenter hides that element rather than drawing empty text.
   */
  slots?: Record<string, string | null>;
  /**
   * Free-form positioned elements, drawn on top of whatever the stage's own
   * scene renders. Any stage may carry them, not just the blank canvas
   * template — the same `null`-clears rule applies.
   */
  canvas?: CanvasElement[] | null;
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
  /**
   * Resolved slot values, present only for templates that declare slots. Kept
   * off the object otherwise so a stage with no editable copy serialises exactly
   * as it did before slots existed.
   */
  slots?: Record<string, string>;
  /**
   * Resolved canvas elements. Like `slots`, absent entirely when neither the
   * template nor the deck stage has any, so a stage that predates the canvas
   * serialises exactly as it did before.
   */
  canvas?: CanvasElement[];
}

/**
 * Today's presentation: every library stage, in library order, no overrides.
 *
 * `blank` templates are excluded. They are starting points for the slide editor,
 * not content — a blank canvas slide in the shipped deck would be a black screen
 * partway through the talk.
 */
export const DEFAULT_DECK: Deck = {
  id: 'default',
  name: 'Wonder — full deck',
  stages: STAGE_LIBRARY_ORDER.filter((stageId) => !STAGE_LIBRARY[stageId].blank).map((stageId) => ({
    stageId,
  })),
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

    if (template.slots) stage.slots = resolveSlots(template.slots, deckStage.slots);

    const canvas = deckStage.canvas === undefined ? template.canvas : deckStage.canvas;
    if (canvas) stage.canvas = canvas;
    else if (template.canvas || deckStage.canvas === null) stage.canvas = [];

    resolved.push(stage);
  }

  return resolved;
}

/**
 * Resolves declared slots against a deck stage's overrides. Only declared keys
 * survive: an override left behind by an earlier version of a template cannot
 * inject copy the component does not render.
 */
function resolveSlots(
  defs: SlotDef[],
  overrides: Record<string, string | null> | undefined
): Record<string, string> {
  const slots: Record<string, string> = {};
  for (const def of defs) {
    const override = overrides?.[def.key];
    slots[def.key] = override === undefined ? def.default : (override ?? '');
  }
  return slots;
}
