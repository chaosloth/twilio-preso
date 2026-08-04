import { create } from 'zustand';
import type { PresentationStateDoc, AggregateResultsDoc, AudienceResponseEvent, AiPromptPendingEvent, AiPromptResponseEvent } from '@twilio-preso/shared';
import { TOTAL_STAGES } from '@twilio-preso/shared';

interface PresenterStore {
  currentStageIndex: number;
  totalParticipants: number;
  activeInteraction: PresentationStateDoc['activeInteraction'];
  aggregateResults: AggregateResultsDoc | null;
  recentResponses: AudienceResponseEvent[];
  aiPromptResponses: AiPromptResponseEvent[];
  /** Questions submitted but not yet answered — shown with a thinking animation. */
  pendingAiPrompts: AiPromptPendingEvent[];
  isLive: boolean;

  advance: () => void;
  back: () => void;
  goTo: (index: number) => void;
  setTotalParticipants: (count: number) => void;
  setActiveInteraction: (interaction: PresentationStateDoc['activeInteraction']) => void;
  setAggregateResults: (results: AggregateResultsDoc | null) => void;
  addResponse: (response: AudienceResponseEvent) => void;
  addAiPromptResponse: (response: AiPromptResponseEvent) => void;
  addPendingAiPrompt: (pending: AiPromptPendingEvent) => void;
  setLive: (live: boolean) => void;
}

export const usePresenterStore = create<PresenterStore>((set) => ({
  currentStageIndex: 0,
  totalParticipants: 0,
  activeInteraction: null,
  aggregateResults: null,
  recentResponses: [],
  aiPromptResponses: [],
  pendingAiPrompts: [],
  isLive: false,

  advance: () => set((s) => ({ currentStageIndex: Math.min(s.currentStageIndex + 1, TOTAL_STAGES - 1) })),
  back: () => set((s) => ({ currentStageIndex: Math.max(s.currentStageIndex - 1, 0) })),
  goTo: (index) => set({ currentStageIndex: Math.max(0, Math.min(index, TOTAL_STAGES - 1)) }),
  setTotalParticipants: (count) => set({ totalParticipants: count }),
  setActiveInteraction: (interaction) => set({ activeInteraction: interaction }),
  setAggregateResults: (results) => set({ aggregateResults: results }),
  addResponse: (response) => set((s) => ({ recentResponses: [...s.recentResponses.slice(-50), response] })),
  addAiPromptResponse: (response) =>
    set((s) => ({
      aiPromptResponses: [...s.aiPromptResponses.slice(-30), response],
      // The answer supersedes that person's pending question.
      pendingAiPrompts: s.pendingAiPrompts.filter((p) => p.participantId !== response.participantId),
    })),
  addPendingAiPrompt: (pending) =>
    set((s) => ({
      pendingAiPrompts: [
        ...s.pendingAiPrompts.filter((p) => p.participantId !== pending.participantId),
        pending,
      ],
    })),
  setLive: (live) => set({ isLive: live }),
}));
