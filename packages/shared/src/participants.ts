import type { ResolvedStage } from './deck.js';
import type { Participant, ParticipantResponse } from './types.js';

/**
 * The one way to read a participant's answer. Replaces searching the response
 * list for a hardcoded `stageIndex`, which silently found the wrong answer (or
 * none) as soon as a deck reordered or omitted a slide.
 */
export function responseFor(
  participant: Participant | null | undefined,
  stageId: string,
): ParticipantResponse | undefined {
  return participant?.responses?.[stageId];
}

export interface AnsweredQuestion {
  stageId: string;
  /** The prompt the audience saw, or null if the stage asks nothing. */
  question: string | null;
  answer: string;
}

/**
 * The participant's answers in the order this deck asked for them, paired with
 * the question each one answered. Used to build the personalisation context for
 * the memory SMS, the voice agent, and the AI-prompt agent.
 *
 * Driven by the deck rather than the response record, which gives deck ordering
 * for free and drops answers for stages this deck never showed — a question the
 * audience was not asked here must not be presented as something they told us.
 * `llm-prompt` answers are excluded: those are the conversation, not context for
 * it.
 */
export function answeredQuestions(
  participant: Participant | null | undefined,
  stages: ResolvedStage[],
): AnsweredQuestion[] {
  if (!participant) return [];

  const answers: AnsweredQuestion[] = [];
  const seen = new Set<string>();

  for (const stage of stages) {
    // A stage may appear twice in a deck; both instances share one answer.
    if (seen.has(stage.id)) continue;

    const response = responseFor(participant, stage.id);
    if (!response?.value || response.type === 'llm-prompt') continue;

    seen.add(stage.id);
    answers.push({
      stageId: stage.id,
      question: stage.interaction?.prompt ?? null,
      answer: response.value,
    });
  }

  return answers;
}
