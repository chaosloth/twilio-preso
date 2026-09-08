import { STAGE_LIBRARY } from './stageLibrary.js';
import type { InteractionType, Participant } from './types.js';

/**
 * What the room as a whole answered one question.
 *
 * Individual answers belong to the person and live on their Conversation Memory
 * profile. This is the other thing the finale needs and nothing else carries:
 * the *collective* answer, which is what the demo actually builds from. One
 * attendee voting for a guided tour does not stop the room building a cupcake
 * store, and the agent has to be able to say both — what got built, and what
 * they personally picked.
 */
export interface RoomTally {
  stageId: string;
  /** The question the audience saw, or null for a stage that asks nothing. */
  question: string | null;
  type: InteractionType;
  /** Every distinct answer with its count, most-chosen first. */
  counts: Array<{ value: string; count: number }>;
  /** How many people answered this question. */
  total: number;
  /** The most-chosen answer. Meaningful even in a tie — `tie` says whether it
   *  won or merely came first. */
  winner: string;
  winnerCount: number;
  /** More than one answer shares the top count. The agent should say the room
   *  was split rather than announce a winner that a coin-toss chose. */
  tie: boolean;
}

/**
 * Response types whose answers are not a collective choice. `llm-prompt` is the
 * conversation itself, and the two call-to-action types publish no response at
 * all — what they produce is a phone call.
 */
const NOT_A_CHOICE = new Set<InteractionType>(['llm-prompt', 'call-cta', 'whatsapp-cta']);

/**
 * Tally every question this room answered.
 *
 * Driven entirely by the responses themselves and by `STAGE_LIBRARY` for the
 * wording — there is no list of "the questions that matter" anywhere here. A
 * poll added to the deck tomorrow is tallied and reaches the voice agent's
 * prompt with no change to this file, which is the point: the presentation's
 * context is whatever the presentation asked.
 */
export function tallyRoom(participants: Participant[]): RoomTally[] {
  /** stageId -> folded answer -> {display, count}. Folded so free text that
   *  differs only in case or padding counts as one answer; the first spelling
   *  the room used is the one reported back. */
  const byStage = new Map<string, { type: InteractionType; answers: Map<string, { value: string; count: number }> }>();

  for (const participant of participants) {
    for (const response of Object.values(participant.responses ?? {})) {
      const value = response.value?.trim();
      if (!value || NOT_A_CHOICE.has(response.type)) continue;

      let stage = byStage.get(response.stageId);
      if (!stage) {
        stage = { type: response.type, answers: new Map() };
        byStage.set(response.stageId, stage);
      }

      const key = value.toLowerCase();
      const existing = stage.answers.get(key);
      if (existing) existing.count += 1;
      else stage.answers.set(key, { value, count: 1 });
    }
  }

  const order = Object.keys(STAGE_LIBRARY);

  return [...byStage.entries()]
    .map(([stageId, { type, answers }]) => {
      const counts = [...answers.values()].sort((a, b) => b.count - a.count);
      const top = counts[0];
      return {
        stageId,
        question: STAGE_LIBRARY[stageId]?.interaction?.prompt ?? null,
        type,
        counts,
        total: counts.reduce((sum, c) => sum + c.count, 0),
        winner: top.value,
        winnerCount: top.count,
        tie: counts.filter((c) => c.count === top.count).length > 1,
      };
    })
    // Library order, so the prompt reads in the order the talk asked. A stage id
    // the library does not know sorts last rather than to the front.
    .sort((a, b) => stageRank(order, a.stageId) - stageRank(order, b.stageId));
}

function stageRank(order: string[], stageId: string): number {
  const index = order.indexOf(stageId);
  return index === -1 ? order.length : index;
}

/** One stage's tally, for the callers that want a specific question. */
export function winnerFor(room: RoomTally[], stageId: string): RoomTally | undefined {
  return room.find((t) => t.stageId === stageId);
}
