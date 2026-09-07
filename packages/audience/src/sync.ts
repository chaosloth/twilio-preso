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

/**
 * Whether the socket is actually carrying updates — not merely whether a client
 * object was ever constructed. A dead connection has to read as disconnected:
 * a badge that says "Connected" while the phone silently stops following the
 * presenter is worse than no badge at all.
 */
export function isSyncConnected(): boolean {
  return syncClient !== null && syncClient.connectionState === 'connected';
}

/**
 * True when the client will never recover on its own — a rejected token or a
 * hard error. Only these two warrant a rebuild. `disconnected`, `retrying` and
 * `connecting` are all states the SDK works its own way out of, and treating
 * them as dead makes the phone tear down and re-create its client every few
 * seconds, which is worse than the stall it was meant to cure.
 */
export function isSyncDead(): boolean {
  const state = syncClient?.connectionState;
  return state === 'denied' || state === 'error';
}

/** Closes the current client so a rebuild does not leave the old socket running. */
export async function shutdownSync(): Promise<void> {
  const client = syncClient;
  syncClient = null;
  currentSessionId = null;
  try {
    await client?.shutdown();
  } catch {
    // Already gone; the point was only to stop it holding a socket open.
  }
}

async function fetchToken(sessionId: string, participantId: string): Promise<string> {
  const res = await fetch(
    `${BACKEND_URL}/api/token?identity=${encodeURIComponent(participantId)}&sessionId=${encodeURIComponent(sessionId)}`
  );
  if (!res.ok) throw new Error(`token request failed: ${res.status}`);
  return (await res.json()).token as string;
}

export async function initSync(sessionId: string, participantId: string): Promise<SyncClient> {
  const client = new SyncClient(await fetchToken(sessionId, participantId));

  // A Sync access token lasts an hour; a presentation plus its rehearsal easily
  // outlives that. Without a refresh the socket is denied mid-talk and the phone
  // quietly stops following the presenter — no error, no reconnect, nothing on
  // screen. Both events fire on the client, so renew on either.
  const renew = async () => {
    try {
      client.updateToken(await fetchToken(sessionId, participantId));
    } catch {
      // The next event, or the app's own retry, will try again.
    }
  };
  client.on('tokenAboutToExpire', renew);
  client.on('tokenExpired', renew);

  syncClient = client;
  currentSessionId = sessionId;
  return client;
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
        | { type: 'error'; message?: string };

      if (event.type === 'delta') {
        full += event.text;
        onDelta?.(event.text);
      } else if (event.type === 'done') {
        done = event.response;
      } else {
        // The backend's own words: it knows whether this is worth retrying.
        throw new Error(event.message || 'ai-prompt stream errored');
      }
    }
  }

  return done || full;
}
