import { SyncClient } from 'twilio-sync';
import type { AudienceResponseEvent, PresentationStateDoc, StageAdvanceEvent, InteractionPromptEvent, InteractionConfig, AggregateResultsDoc } from '@twilio-preso/shared';
import { usePresenterStore } from './store';
import { suppressPublish } from './hooks/useNavigation';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const EVENT_STREAM = 'event-stream';
const PRESENTATION_STATE_DOC = 'presentation-state';
const AGGREGATE_RESULTS_DOC = 'aggregate-results';

let syncClient: SyncClient | null = null;
let stateDocument: any = null;
const windowId = `presenter-${Math.random().toString(36).slice(2)}`;

export async function initPresenterSync(): Promise<void> {
  let res: Response;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      res = await fetch(`${BACKEND_URL}/api/token?identity=${windowId}`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!res!) return;
  const { token } = await res.json();

  syncClient = new SyncClient(token);

  // Subscribe to event stream
  const stream = await syncClient.stream(EVENT_STREAM);
  stream.on('messagePublished', (event: { message: { data: any } }) => {
    const data = event.message.data;
    if (data.type === 'audience-response') {
      usePresenterStore.getState().addResponse(data as AudienceResponseEvent);
    } else if (data.type === 'participant-joined') {
      const store = usePresenterStore.getState();
      store.setTotalParticipants(store.totalParticipants + 1);
    }
  });

  // Subscribe to presentation state document — this is the PRIMARY sync mechanism
  // All windows watch this document. When any window advances, it updates the doc.
  stateDocument = await syncClient.document(PRESENTATION_STATE_DOC);
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
  const resultsDoc = await syncClient.document(AGGREGATE_RESULTS_DOC);
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
  if (!syncClient) return;
  try {
    const stream = await syncClient.stream(EVENT_STREAM);
    const event: StageAdvanceEvent = { type: 'stage-advance', stageIndex, timestamp: Date.now() };
    await stream.publishMessage({ data: event });
  } catch (err) {
    console.warn('Failed to publish stage advance:', err);
  }
}

export async function publishInteractionPrompt(interaction: InteractionConfig): Promise<void> {
  if (!syncClient) return;
  try {
    const stream = await syncClient.stream(EVENT_STREAM);
    const event: InteractionPromptEvent = { type: 'interaction-prompt', interaction, timestamp: Date.now() };
    await stream.publishMessage({ data: event });
  } catch (err) {
    console.warn('Failed to publish interaction:', err);
  }
}

export async function triggerDemo(triggerId: string, targetParticipantId?: string): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerId, targetParticipantId }),
    });
  } catch {}
}

export function isSyncConnected(): boolean {
  return syncClient !== null;
}
