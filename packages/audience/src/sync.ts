import { SyncClient } from 'twilio-sync';
import type { InteractionConfig } from '@twilio-preso/shared';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const EVENT_STREAM = 'event-stream';

let syncClient: SyncClient | null = null;

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
  const stream = await client.stream(EVENT_STREAM);

  stream.on('messagePublished', (event) => {
    const data = event.message.data as any;
    if (data.type === 'interaction-prompt') {
      onInteraction(data.interaction);
    } else if (data.type === 'stage-advance') {
      onStageAdvance(data.stageIndex);
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
  const client = getSyncClient();
  const stream = await client.stream(EVENT_STREAM);

  await stream.publishMessage({
    data: {
      type: 'audience-response',
      participantId,
      participantName,
      stageIndex,
      interactionType,
      value,
      timestamp: Date.now(),
    },
  });
}
