import { SyncClient } from 'twilio-sync';
import { syncNames } from '@twilio-preso/shared';
import type { InteractionConfig } from '@twilio-preso/shared';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

let syncClient: SyncClient | null = null;
/**
 * The session this client is connected to. Held here so `subscribeToEvents` and
 * the POST helpers cannot be called against a different session than the token
 * was issued for — every object name below is derived from it.
 */
let currentSessionId: string | null = null;

export function isSyncConnected(): boolean {
  return syncClient !== null;
}

export async function initSync(sessionId: string, participantId: string): Promise<SyncClient> {
  const res = await fetch(
    `${BACKEND_URL}/api/token?identity=${encodeURIComponent(participantId)}&sessionId=${encodeURIComponent(sessionId)}`
  );
  if (!res.ok) throw new Error(`token request failed: ${res.status}`);
  const { token } = await res.json();

  syncClient = new SyncClient(token);
  currentSessionId = sessionId;
  return syncClient;
}

function sessionNames() {
  if (!currentSessionId) throw new Error('Sync client not initialized');
  return syncNames(currentSessionId);
}

export function getSyncClient(): SyncClient {
  if (!syncClient) throw new Error('Sync client not initialized');
  return syncClient;
}

export async function subscribeToEvents(
  /**
   * `stageIndex` is the deck position the interaction was prompted from. It
   * comes from the event rather than the interaction itself — interactions are
   * keyed by stage id now, since a stage's position varies between decks.
   */
  onInteraction: (interaction: InteractionConfig, stageIndex: number) => void,
  onStageAdvance: (stageIndex: number) => void
): Promise<void> {
  const client = getSyncClient();
  const names = sessionNames();

  // Subscribe to stream for real-time events
  const stream = await client.stream(names.events);
  stream.on('messagePublished', (event: any) => {
    const data = event.message.data;
    if (data.type === 'interaction-prompt') {
      onInteraction(data.interaction, data.stageIndex);
    } else if (data.type === 'stage-advance') {
      onStageAdvance(data.stageIndex);
    }
  });

  // Also subscribe to the presentation state document (more reliable for interactions)
  const stateDoc = await client.document(names.state);

  // Check initial state — if there's an active interaction, show it
  const initialData = stateDoc.data as any;
  if (initialData?.activeInteraction) {
    onInteraction(initialData.activeInteraction, initialData.currentStageIndex ?? 0);
  }

  stateDoc.on('updated', (event: any) => {
    const data = event.data;
    if (data.activeInteraction) {
      onInteraction(data.activeInteraction, data.currentStageIndex ?? 0);
    } else {
      onStageAdvance(data.currentStageIndex);
    }
  });
}

export async function publishResponse(
  sessionId: string,
  participantId: string,
  participantName: string,
  stageId: string,
  stageIndex: number,
  interactionType: string,
  value: string
): Promise<void> {
  await fetch(`${BACKEND_URL}/api/response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      participantId,
      participantName,
      stageId,
      stageIndex,
      interactionType,
      value,
    }),
  });
}

/**
 * Sends the prompt and consumes the backend's SSE stream, invoking `onDelta`
 * for each chunk of text as it arrives. Resolves with the full answer.
 */
export async function submitAiPrompt(
  sessionId: string,
  participantId: string,
  participantName: string,
  stageId: string,
  stageIndex: number,
  prompt: string,
  onDelta?: (text: string) => void
): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/ai-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, participantId, participantName, stageId, stageIndex, prompt }),
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
