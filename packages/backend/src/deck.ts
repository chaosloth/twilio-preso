import { DEFAULT_DECK, resolveDeck } from '@twilio-preso/shared';

/**
 * The deck the backend resolves prompts and triggers against.
 *
 * Temporary module-level resolution of DEFAULT_DECK, standing in for the
 * per-session deck read from the session record once sessions exist. Call sites
 * already read a resolved array, so only this file changes then.
 */
export const STAGES = resolveDeck(DEFAULT_DECK);
