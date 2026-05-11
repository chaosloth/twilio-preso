import { SyncClient } from 'twilio-sync';
import type { InteractionConfig } from '@twilio-preso/shared';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const EVENT_STREAM = 'event-stream';
const PRESENTATION_STATE_DOC = 'presentation-state';

let syncClient: SyncClient | null = null;

export function isSyncConnected(): boolean {
  return syncClient !== null;
}

export async function initSync(participantId: string): Promise<SyncClient> {
  const res = await fetch(`${BACKEND_URL}/api/token?identity=${participantId}`);
  const { token } = await res.json();

  syncClient = new SyncClient(token);
  return syncClient;
}

export function getSyncClient(): SyncClient {
  if (!syncClient) throw new Error('Sync client not initialized');
  return syncClient;
}

export async function subscribeToEvents(
  onInteraction: (interaction: InteractionConfig) => void,
  onStageAdvance: (stageIndex: number) => void
): Promise<void> {
  const client = getSyncClient();

  // Subscribe to stream for real-time events
  const stream = await client.stream(EVENT_STREAM);
  stream.on('messagePublished', (event: any) => {
    const data = event.message.data;
    if (data.type === 'interaction-prompt') {
      onInteraction(data.interaction);
    } else if (data.type === 'stage-advance') {
      onStageAdvance(data.stageIndex);
    }
  });

  // Also subscribe to the presentation state document (more reliable for interactions)
  const stateDoc = await client.document(PRESENTATION_STATE_DOC);

  // Check initial state — if there's an active interaction, show it
  const initialData = stateDoc.data as any;
  if (initialData?.activeInteraction) {
    onInteraction(initialData.activeInteraction);
  }

  stateDoc.on('updated', (event: any) => {
    const data = event.data;
    if (data.activeInteraction) {
      onInteraction(data.activeInteraction);
    } else {
      onStageAdvance(data.currentStageIndex);
    }
  });
}

export async function publishResponse(
  participantId: string,
  participantName: string,
  stageIndex: number,
  interactionType: string,
  value: string
): Promise<void> {
  await fetch(`${BACKEND_URL}/api/response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, participantName, stageIndex, interactionType, value }),
  });
}
