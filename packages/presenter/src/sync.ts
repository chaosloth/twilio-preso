import { SyncClient } from 'twilio-sync';
import type { AudienceResponseEvent, PresentationStateDoc, StageAdvanceEvent, InteractionPromptEvent, InteractionConfig, AggregateResultsDoc } from '@twilio-preso/shared';
import { usePresenterStore } from './store';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const EVENT_STREAM = 'event-stream';
const PRESENTATION_STATE_DOC = 'presentation-state';
const AGGREGATE_RESULTS_DOC = 'aggregate-results';

let syncClient: SyncClient | null = null;
let isController = false;

export async function initPresenterSync(controller = false): Promise<void> {
  isController = controller;
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/token?identity=presenter-${Date.now()}`);
  } catch {
    return;
  }
  const { token } = await res.json();

  syncClient = new SyncClient(token);

  const stream = await syncClient.stream(EVENT_STREAM);
  stream.on('messagePublished', (event: { message: { data: any } }) => {
    const data = event.message.data;
    if (data.type === 'audience-response') {
      usePresenterStore.getState().addResponse(data as AudienceResponseEvent);
    } else if (data.type === 'participant-joined') {
      const store = usePresenterStore.getState();
      store.setTotalParticipants(store.totalParticipants + 1);
    } else if (data.type === 'stage-advance') {
      // All presenter windows follow stage-advance events
      const store = usePresenterStore.getState();
      if (store.currentStageIndex !== data.stageIndex) {
        store.goTo(data.stageIndex);
      }
    }
  });

  const stateDoc = await syncClient.document(PRESENTATION_STATE_DOC);
  stateDoc.on('updated', (event: { data: any }) => {
    const data = event.data as PresentationStateDoc;
    usePresenterStore.getState().setTotalParticipants(data.totalParticipants);
  });

  const resultsDoc = await syncClient.document(AGGREGATE_RESULTS_DOC);
  resultsDoc.on('updated', (event: { data: any }) => {
    usePresenterStore.getState().setAggregateResults(event.data as AggregateResultsDoc);
  });

  usePresenterStore.getState().setLive(true);
}

export async function publishStageAdvance(stageIndex: number): Promise<void> {
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
