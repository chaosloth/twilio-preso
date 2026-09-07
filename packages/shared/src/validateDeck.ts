import type { Deck } from './deck.js';
import { STAGE_LIBRARY } from './stageLibrary.js';

export type DeckWarningCode =
  | 'unknown-stage'
  | 'missing-dependency'
  | 'dependency-after-trigger'
  | 'no-model-access';

export interface DeckWarning {
  code: DeckWarningCode;
  /** Deck position of the offending stage. */
  stageIndex: number;
  stageId: string;
  /** For dependency warnings: the stage id that is missing or out of order. */
  dependsOn?: string;
  /** Shown verbatim in the HUD. */
  message: string;
}

export interface ValidateDeckOptions {
  /**
   * Whether the backend has a usable model configured. Omit when the caller
   * cannot know (the presenter HUD has no env visibility) — an unknown is not
   * reported as a failure.
   */
  hasModelAccess?: boolean;
}

/**
 * Catch what reordering a deck introduces. These are **warnings, not errors**:
 * a presenter who wants the memory SMS with its generic fallback copy may run
 * it. Nothing here blocks a presentation.
 */
export function validateDeck(deck: Deck, opts: ValidateDeckOptions = {}): DeckWarning[] {
  const warnings: DeckWarning[] = [];

  // Deck position of the first appearance of each known stage id.
  const firstAppearance = new Map<string, number>();
  deck.stages.forEach((deckStage, index) => {
    if (STAGE_LIBRARY[deckStage.stageId] && !firstAppearance.has(deckStage.stageId)) {
      firstAppearance.set(deckStage.stageId, index);
    }
  });

  deck.stages.forEach((deckStage, stageIndex) => {
    const { stageId } = deckStage;
    const template = STAGE_LIBRARY[stageId];

    if (!template) {
      warnings.push({
        code: 'unknown-stage',
        stageIndex,
        stageId,
        message: `Stage "${stageId}" is not in the stage library — slide ${stageIndex + 1} will be skipped.`,
      });
      return;
    }

    const demoTrigger =
      deckStage.demoTrigger === undefined ? template.demoTrigger : deckStage.demoTrigger;
    const interaction =
      deckStage.interaction === undefined ? template.interaction : deckStage.interaction;

    if (demoTrigger) {
      for (const dependency of template.dependsOn ?? []) {
        const dependencyIndex = firstAppearance.get(dependency);

        if (dependencyIndex === undefined) {
          warnings.push({
            code: 'missing-dependency',
            stageIndex,
            stageId,
            dependsOn: dependency,
            message: `"${template.title}" fires ${demoTrigger}, which reads answers from "${dependency}" — that stage is not in this deck, so the trigger will fall back to generic copy.`,
          });
        } else if (dependencyIndex > stageIndex) {
          warnings.push({
            code: 'dependency-after-trigger',
            stageIndex,
            stageId,
            dependsOn: dependency,
            message: `"${template.title}" fires ${demoTrigger} on slide ${stageIndex + 1}, but "${dependency}" collects the answers it reads on slide ${dependencyIndex + 1} — no answers will exist yet.`,
          });
        }
      }
    }

    if (interaction?.type === 'llm-prompt' && opts.hasModelAccess === false) {
      warnings.push({
        code: 'no-model-access',
        stageIndex,
        stageId,
        message: `"${template.title}" asks the audience to prompt a model, but no model is configured — prompts will fail.`,
      });
    }
  });

  return warnings;
}
