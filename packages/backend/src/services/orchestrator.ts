import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import type { OrchestratorCommunication } from './orchestratorEvents.js';

/**
 * Twilio Conversation Orchestrator — the capture layer behind the text agent.
 *
 * What it is *not* is an inbound bot webhook. Orchestrator captures SMS/WhatsApp
 * traffic into `Conversation` → `Communication` objects linked to Conversation
 * Memory profiles, and its webhooks are post-event status callbacks. So the text
 * agent is assembled the other way round from the voice one: the callback tells
 * us a message arrived, the conversation holds the thread, and the reply goes out
 * over the ordinary Messages API.
 *
 * Three things about this API each fail as something else:
 *
 * - **Configuration writes are asynchronous.** POST/PUT/DELETE answer `202` with
 *   a `statusUrl`, not the configuration — so a caller that reads the response
 *   body sees no configuration and concludes it failed. `awaitOperation` polls.
 * - **Creation is not idempotent**, like the Content API: two POSTs make two
 *   configurations. Existing ones are listed and matched by `displayName`.
 * - **`conversationGroupingType` is immutable.** Changing it needs a new
 *   configuration and a migration, which is why it is not a setting here.
 *
 * A basic-auth fetch client, like `content.ts` and `memory.ts`: there is no Node
 * SDK surface for these endpoints.
 */

const BASE = 'https://conversations.twilio.com/v2';

/** ≤32 chars, `^[a-zA-Z0-9-_ ]+$`. The name this app's configuration is matched
 *  by, so pressing the HUD button twice updates rather than duplicates. */
export const CONFIGURATION_NAME = 'wonder-preso';

function authHeader(): string {
  const { accountSid, authToken } = config.twilio;
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
}

interface FetchOptions {
  method?: string;
  body?: unknown;
  /** Sent on writes. Twilio holds it for 24 hours, account- and region-scoped,
   *  so a retried press of the HUD button is not a second configuration. */
  idempotent?: boolean;
}

async function orchestratorFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: authHeader(),
    'Content-Type': 'application/json',
  };
  if (opts.idempotent) headers['Idempotency-Key'] = randomUUID();

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Orchestrator ${opts.method ?? 'GET'} ${path} failed: ${res.status} ${text}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export interface OrchestratorConfiguration {
  id?: string;
  displayName?: string;
  description?: string;
  conversationGroupingType?: string;
  memoryStoreId?: string;
  statusCallbacks?: Array<{ url: string; method?: string }>;
  channelSettings?: Record<string, unknown>;
}

export async function listConfigurations(): Promise<OrchestratorConfiguration[]> {
  const page = await orchestratorFetch<{ configurations?: OrchestratorConfiguration[] }>(
    '/ControlPlane/Configurations?pageSize=50'
  );
  return page.configurations ?? [];
}

export async function findConfiguration(): Promise<OrchestratorConfiguration | null> {
  const all = await listConfigurations();
  return all.find((c) => c.displayName === CONFIGURATION_NAME) ?? null;
}

interface Operation {
  status?: string;
  errorMessage?: string;
  related?: { configurationId?: string };
}

/**
 * Waits for one of those `202`s to land.
 *
 * `statusUrl` is absolute, so it is fetched as given rather than joined onto
 * `BASE` — the operations resource has lived at more than one path and following
 * Twilio's own link is what keeps this working when it moves again.
 */
async function awaitOperation(statusUrl: string): Promise<Operation> {
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((r) => setTimeout(r, attempt === 0 ? 500 : 1500));
    const res = await fetch(statusUrl, { headers: { Authorization: authHeader() } });
    if (!res.ok) continue;
    const operation = (await res.json()) as Operation;
    const status = (operation.status ?? '').toUpperCase();
    if (status === 'COMPLETED') return operation;
    if (status === 'FAILED') {
      throw new Error(`Orchestrator operation failed: ${operation.errorMessage ?? 'no reason given'}`);
    }
  }
  throw new Error('Orchestrator operation did not complete in time');
}

/**
 * Capture rules for the numbers this deployment sends from.
 *
 * Bidirectional, because the agent's own replies have to reach the conversation
 * or the thread history is one-sided — and that is precisely why the webhook has
 * to drop events authored by a pool number (`inboundText`).
 *
 * **SMS and WhatsApp only.** A VOICE capture rule alongside `<ConversationRelay>`
 * on the same call bills speech-to-text twice, so this app never declares one;
 * the voice side is served by active TwiML instead.
 */
function channelSettings(numbers: string[]): Record<string, unknown> {
  const rules = numbers.flatMap((number) => [
    { from: '*', to: number },
    { from: number, to: '*' },
  ]);
  return {
    SMS: { captureRules: rules, statusTimeouts: { inactive: 10, closed: 30 } },
    WHATSAPP: { captureRules: rules, statusTimeouts: { inactive: 10, closed: 30 } },
  };
}

/** The status-callback URL Twilio is told to call, secret and all. */
export function webhookUrl(): string {
  const base = config.publicBaseUrl.replace(/\/$/, '');
  return `${base}/api/orchestrator/webhook?token=${encodeURIComponent(
    config.orchestratorWebhookToken
  )}`;
}

export interface EnsureResult {
  configurationId: string;
  created: boolean;
  webhookUrl: string;
  numbers: string[];
}

/**
 * Creates the configuration or brings the existing one up to date.
 *
 * Manual, like declaring content templates and memory trait groups: it writes
 * account-level Twilio configuration that outlives the event, so it is a button
 * a presenter presses rather than something a boot does.
 */
export async function ensureConfiguration(): Promise<EnsureResult> {
  if (!config.orchestratorWebhookToken) {
    throw new Error(
      'ORCHESTRATOR_WEBHOOK_TOKEN is not set — registering a callback URL the webhook will refuse is worse than not registering one'
    );
  }
  if (!config.twilio.memoryStoreId) {
    throw new Error('TWILIO_MEMORY_STORE_ID is not set — a configuration needs a memory store');
  }

  const numbers = config.twilio.phonePool;
  const url = webhookUrl();
  const existing = await findConfiguration();

  const payload: Record<string, unknown> = {
    displayName: CONFIGURATION_NAME,
    description: 'Live-presentation text agent: captures SMS and WhatsApp into Conversation Memory profiles.',
    memoryStoreId: config.twilio.memoryStoreId,
    statusCallbacks: [{ url, method: 'POST' }],
    channelSettings: channelSettings(numbers),
    memoryExtractionEnabled: true,
  };

  if (existing?.id) {
    // `conversationGroupingType` is immutable, so it is only ever sent on create
    // — including it in an update is a 400 on a configuration that already has it.
    const res = await orchestratorFetch<{ statusUrl?: string }>(
      `/ControlPlane/Configurations/${existing.id}`,
      { method: 'PUT', body: payload, idempotent: true }
    );
    if (res.statusUrl) await awaitOperation(res.statusUrl);
    return { configurationId: existing.id, created: false, webhookUrl: url, numbers };
  }

  const res = await orchestratorFetch<{ statusUrl?: string; id?: string }>(
    '/ControlPlane/Configurations',
    {
      method: 'POST',
      // One conversation per person, not per address pair: the same attendee
      // texting from WhatsApp and from SMS is one thread, which is what makes the
      // agent's history theirs rather than the channel's.
      body: { ...payload, conversationGroupingType: 'GROUP_BY_PROFILE' },
      idempotent: true,
    }
  );
  const operation = res.statusUrl ? await awaitOperation(res.statusUrl) : null;
  const id = operation?.related?.configurationId ?? res.id ?? (await findConfiguration())?.id ?? '';
  return { configurationId: id, created: true, webhookUrl: url, numbers };
}

/**
 * The thread so far.
 *
 * Read from the Orchestrator conversation rather than kept in a store of our own
 * — that is the reason to route text through Orchestrator at all, and it means a
 * backend restart mid-thread does not lose the conversation.
 */
export async function listCommunications(
  conversationId: string
): Promise<OrchestratorCommunication[]> {
  const page = await orchestratorFetch<{ communications?: OrchestratorCommunication[] }>(
    `/Conversations/${encodeURIComponent(conversationId)}/Communications?pageSize=50`
  );
  return page.communications ?? [];
}

/** What the HUD's Config row reports. */
export interface OrchestratorState {
  configured: boolean;
  configurationId?: string;
  /** True when the registered callback is *this* deployment's URL. A stale one
   *  points a tunnel that has since died at a live account. */
  callbackMatches: boolean;
  registeredCallback?: string;
}

export async function describeOrchestrator(): Promise<OrchestratorState> {
  const existing = await findConfiguration();
  const registered = existing?.statusCallbacks?.[0]?.url;
  return {
    configured: !!existing,
    configurationId: existing?.id,
    registeredCallback: registered,
    callbackMatches: registered === webhookUrl(),
  };
}
