import { DEFAULT_DECK, resolveDeck } from '@twilio-preso/shared';

/**
 * The deck this presenter instance is showing.
 *
 * Temporary module-level resolution of DEFAULT_DECK, standing in for the
 * per-session deck that will arrive from the session record. When the store
 * gains `stages: ResolvedStage[]`, this module goes away and components read
 * from the store instead — the call sites already read a resolved array, so
 * only this file changes.
 */
export const STAGES = resolveDeck(DEFAULT_DECK);

export const TOTAL_STAGES = STAGES.length;
