import { SyncClient } from 'twilio-sync';
import type { AudienceResponseEvent, PresentationStateDoc, StageAdvanceEvent, InteractionPromptEvent, InteractionConfig, AggregateResultsDoc, AiPromptPendingEvent, AiPromptResponseEvent } from '@twilio-preso/shared';
import { syncNames } from '@twilio-preso/shared';
import { usePresenterStore } from './store';
import { suppressPublish } from './hooks/useNavigation';
import { authHeaders } from './auth';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

let syncClient: SyncClient | null = null;
let stateDocument: any = null;
/** Object names are derived from this, so nothing here can address another
 *  session's documents. */
let names: ReturnType<typeof syncNames> | null = null;
const windowId = `presenter-${Math.random().toString(36).slice(2)}`;

export async function initPresenterSync(sessionId: string): Promise<void> {
  names = syncNames(sessionId);

  // The token is presenter-issued: `identity` is this window, not a
  // participant, so the request needs the bearer token to be authorised.
  let res: Response;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      res = await fetch(
        `${BACKEND_URL}/api/token?identity=${windowId}&sessionId=${encodeURIComponent(sessionId)}`,
        { headers: authHeaders() }
      );
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!res! || !res.ok) return;
  const { token } = await res.json();

  syncClient = new SyncClient(token);

  // Subscribe to event stream
  const stream = await syncClient.stream(names.events);
  stream.on('messagePublished', (event: { message: { data: any } }) => {
    const data = event.message.data;
    if (data.type === 'audience-response') {
      usePresenterStore.getState().addResponse(data as AudienceResponseEvent);
    } else if (data.type === 'ai-prompt-pending') {
      usePresenterStore.getState().addPendingAiPrompt(data as AiPromptPendingEvent);
    } else if (data.type === 'ai-prompt-response') {
      usePresenterStore.getState().addAiPromptResponse(data as AiPromptResponseEvent);
    } else if (data.type === 'participant-joined') {
      const store = usePresenterStore.getState();
      store.setTotalParticipants(store.totalParticipants + 1);
    }
  });

  // Subscribe to presentation state document — this is the PRIMARY sync mechanism
  // All windows watch this document. When any window advances, it updates the doc.
  stateDocument = await syncClient.document(names.state);
  const initialData = stateDocument.data as PresentationStateDoc;
  if (initialData.currentStageIndex !== undefined && initialData.currentStageIndex !== 0) {
    suppressPublish();
    usePresenterStore.getState().goTo(initialData.currentStageIndex);
  }
  if (initialData.totalParticipants) {
    usePresenterStore.getState().setTotalParticipants(initialData.totalParticipants);
  }
  if (initialData.isLive !== undefined) {
    usePresenterStore.getState().setLive(initialData.isLive);
  }

  stateDocument.on('updated', (event: { data: any }) => {
    const data = event.data as PresentationStateDoc;
    const store = usePresenterStore.getState();
    // Sync stage from document — this fires for ALL clients including cross-laptop
    if (data.currentStageIndex !== undefined && data.currentStageIndex !== store.currentStageIndex) {
      suppressPublish();
      store.goTo(data.currentStageIndex);
    }
    store.setTotalParticipants(data.totalParticipants);
    if (data.isLive !== undefined) {
      store.setLive(data.isLive);
    }
  });

  // Subscribe to aggregate results
  const resultsDoc = await syncClient.document(names.aggregate);
  resultsDoc.on('updated', (event: { data: any }) => {
    usePresenterStore.getState().setAggregateResults(event.data as AggregateResultsDoc);
  });

}

export async function publishStageAdvance(stageIndex: number, interaction?: InteractionConfig | null): Promise<void> {
  // Update the Sync Document — all other windows AND audience will receive the update
  if (stateDocument) {
    try {
      await stateDocument.update({
        currentStageIndex: stageIndex,
        activeInteraction: interaction || null,
      });
    } catch (err) {
      console.warn('Failed to update presentation state:', err);
    }
  }

  // Also publish to stream for audience apps
  if (!syncClient || !names) return;
  try {
    const stream = await syncClient.stream(names.events);
    const event: StageAdvanceEvent = { type: 'stage-advance', stageIndex, timestamp: Date.now() };
    await stream.publishMessage({ data: event });
  } catch (err) {
    console.warn('Failed to publish stage advance:', err);
  }
}

export async function publishInteractionPrompt(interaction: InteractionConfig): Promise<void> {
  if (!syncClient || !names) return;
  try {
    const stream = await syncClient.stream(names.events);
    const event: InteractionPromptEvent = { type: 'interaction-prompt', interaction, timestamp: Date.now() };
    await stream.publishMessage({ data: event });
  } catch (err) {
    console.warn('Failed to publish interaction:', err);
  }
}

export async function triggerDemo(
  sessionId: string,
  triggerId: string,
  targetParticipantId?: string
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ sessionId, triggerId, targetParticipantId }),
    });
  } catch {}
}

export function isSyncConnected(): boolean {
  return syncClient !== null;
}
