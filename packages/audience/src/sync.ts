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

/**
 * Sends the prompt and consumes the backend's SSE stream, invoking `onDelta`
 * for each chunk of text as it arrives. Resolves with the full answer.
 */
export async function submitAiPrompt(
  participantId: string,
  participantName: string,
  stageIndex: number,
  prompt: string,
  onDelta?: (text: string) => void
): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/ai-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, participantName, stageIndex, prompt }),
  });
  if (!res.ok || !res.body) throw new Error('ai-prompt request failed');

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let full = '';
  let done = '';

  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buffer += value;

    // SSE frames are separated by a blank line.
    let split: number;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);

      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;

      const event = JSON.parse(line.slice(5).trim()) as
        | { type: 'delta'; text: string }
        | { type: 'done'; response: string }
        | { type: 'error' };

      if (event.type === 'delta') {
        full += event.text;
        onDelta?.(event.text);
      } else if (event.type === 'done') {
        done = event.response;
      } else {
        throw new Error('ai-prompt stream errored');
      }
    }
  }

  return done || full;
}
