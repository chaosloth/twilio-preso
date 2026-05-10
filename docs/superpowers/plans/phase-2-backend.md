# Phase 2: Backend Server & Twilio Sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Implement the backend server with Twilio Sync integration, token endpoint for clients, audience registration, and demo trigger routes.

**Architecture:** Fastify routes that provision Sync tokens, manage audience state via Sync Maps/Documents/Streams, and trigger Twilio SMS/Voice APIs.

**Tech Stack:** TypeScript, Node.js, Fastify, Twilio SDK

---

### Task 1: Twilio Sync service

**Files:**
- Create: `packages/backend/src/services/sync.ts`

- [ ] **Step 1: Create Sync service**

```typescript
// packages/backend/src/services/sync.ts
import Twilio from 'twilio';
import { config } from '../config.js';
import type { PresentationStateDoc, AggregateResultsDoc, SyncStreamEvent, Participant } from '@twilio-preso/shared';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);
const syncService = client.sync.v1.services(config.twilio.syncServiceSid);

// Document names
const PRESENTATION_STATE_DOC = 'presentation-state';
const AGGREGATE_RESULTS_DOC = 'aggregate-results';

// Stream name
const EVENT_STREAM = 'event-stream';

// Map name
const PARTICIPANTS_MAP = 'participants';

export async function initSync(): Promise<void> {
  // Create or fetch the presentation state document
  try {
    await syncService.documents.create({
      uniqueName: PRESENTATION_STATE_DOC,
      data: { currentStageIndex: 0, activeInteraction: null, totalParticipants: 0, isLive: true } satisfies PresentationStateDoc,
    });
  } catch (e: any) {
    if (e.code !== 54301) throw e; // 54301 = already exists
  }

  // Create or fetch the aggregate results document
  try {
    await syncService.documents.create({
      uniqueName: AGGREGATE_RESULTS_DOC,
      data: { stageIndex: 0, type: 'poll', results: {}, totalResponses: 0 } satisfies AggregateResultsDoc,
    });
  } catch (e: any) {
    if (e.code !== 54301) throw e;
  }

  // Create or fetch the event stream
  try {
    await syncService.syncStreams.create({ uniqueName: EVENT_STREAM });
  } catch (e: any) {
    if (e.code !== 54301) throw e;
  }

  // Create or fetch participants map
  try {
    await syncService.syncMaps.create({ uniqueName: PARTICIPANTS_MAP });
  } catch (e: any) {
    if (e.code !== 54301) throw e;
  }
}

export async function publishEvent(event: SyncStreamEvent): Promise<void> {
  await syncService.syncStreams(EVENT_STREAM).streamMessages.create({ data: event });
}

export async function updatePresentationState(updates: Partial<PresentationStateDoc>): Promise<void> {
  const doc = await syncService.documents(PRESENTATION_STATE_DOC).fetch();
  await syncService.documents(PRESENTATION_STATE_DOC).update({
    data: { ...doc.data, ...updates },
  });
}

export async function updateAggregateResults(results: AggregateResultsDoc): Promise<void> {
  await syncService.documents(AGGREGATE_RESULTS_DOC).update({ data: results });
}

export async function addParticipant(participant: Participant): Promise<void> {
  await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems.create({
    key: participant.id,
    data: participant,
  });
  // Update participant count
  const items = await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems.list();
  await updatePresentationState({ totalParticipants: items.length });
}

export async function getParticipant(id: string): Promise<Participant | null> {
  try {
    const item = await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems(id).fetch();
    return item.data as Participant;
  } catch {
    return null;
  }
}

export async function updateParticipant(id: string, updates: Partial<Participant>): Promise<void> {
  const item = await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems(id).fetch();
  await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems(id).update({
    data: { ...item.data, ...updates },
  });
}

export async function getAllParticipants(): Promise<Participant[]> {
  const items = await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems.list();
  return items.map((item) => item.data as Participant);
}

export function generateSyncToken(identity: string): string {
  const AccessToken = Twilio.jwt.AccessToken;
  const SyncGrant = AccessToken.SyncGrant;

  const token = new AccessToken(
    config.twilio.accountSid,
    config.twilio.apiKeySid,
    config.twilio.apiKeySecret,
    { identity }
  );

  const syncGrant = new SyncGrant({ serviceSid: config.twilio.syncServiceSid });
  token.addGrant(syncGrant);

  return token.toJwt();
}
```

- [ ] **Step 2: Update config.ts to include API key credentials**

```typescript
// packages/backend/src/config.ts
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  twilio: {
    accountSid: requireEnv('TWILIO_ACCOUNT_SID'),
    authToken: requireEnv('TWILIO_AUTH_TOKEN'),
    apiKeySid: requireEnv('TWILIO_API_KEY_SID'),
    apiKeySecret: requireEnv('TWILIO_API_KEY_SECRET'),
    syncServiceSid: requireEnv('TWILIO_SYNC_SERVICE_SID'),
    messagingServiceSid: requireEnv('TWILIO_MESSAGING_SERVICE_SID'),
    phoneNumber: requireEnv('TWILIO_PHONE_NUMBER'),
  },
} as const;
```

- [ ] **Step 3: Update .env.example**

Add these lines to the root `.env.example`:

```bash
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/services/sync.ts packages/backend/src/config.ts .env.example
git commit -m "feat: add Twilio Sync service with streams, documents, and maps"
```

---

### Task 2: Token endpoint

**Files:**
- Create: `packages/backend/src/routes/token.ts`

- [ ] **Step 1: Create token route**

```typescript
// packages/backend/src/routes/token.ts
import type { FastifyInstance } from 'fastify';
import { generateSyncToken } from '../services/sync.js';

interface TokenQuery {
  identity: string;
}

export async function tokenRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: TokenQuery }>('/api/token', async (request, reply) => {
    const { identity } = request.query;
    if (!identity) {
      return reply.status(400).send({ error: 'identity query param required' });
    }
    const token = generateSyncToken(identity);
    return { token, identity };
  });
}
```

- [ ] **Step 2: Register route in index.ts**

```typescript
// packages/backend/src/index.ts
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { initSync } from './services/sync.js';
import { tokenRoutes } from './routes/token.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(tokenRoutes);

app.get('/health', async () => ({ status: 'ok' }));

await initSync();
await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`Backend running on http://localhost:${config.port}`);
```

- [ ] **Step 3: Test the endpoint**

```bash
curl "http://localhost:3001/api/token?identity=test-user"
```

Expected: Returns JSON with `{ "token": "eyJ...", "identity": "test-user" }`.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/routes/token.ts packages/backend/src/index.ts
git commit -m "feat: add Sync token endpoint for client authentication"
```

---

### Task 3: Lookup + Verify endpoints

**Files:**
- Create: `packages/backend/src/routes/verify.ts`
- Create: `packages/backend/src/services/verify.ts`

- [ ] **Step 1: Create verify service (Lookup API + Verify API)**

```typescript
// packages/backend/src/services/verify.ts
import Twilio from 'twilio';
import { config } from '../config.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

export async function lookupPhone(phone: string): Promise<{ valid: boolean; formatted: string }> {
  try {
    const lookup = await client.lookups.v2.phoneNumbers(phone).fetch();
    return { valid: lookup.valid, formatted: lookup.phoneNumber };
  } catch {
    return { valid: false, formatted: phone };
  }
}

export async function startVerification(phone: string): Promise<void> {
  await client.verify.v2
    .services(config.twilio.verifyServiceSid)
    .verifications.create({ to: phone, channel: 'sms' });
}

export async function checkVerification(phone: string, code: string): Promise<boolean> {
  const check = await client.verify.v2
    .services(config.twilio.verifyServiceSid)
    .verificationChecks.create({ to: phone, code });
  return check.status === 'approved';
}
```

- [ ] **Step 2: Create verify routes**

```typescript
// packages/backend/src/routes/verify.ts
import type { FastifyInstance } from 'fastify';
import { lookupPhone, startVerification, checkVerification } from '../services/verify.js';

interface StartBody { phone: string; }
interface CheckBody { phone: string; code: string; }

export async function verifyRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: StartBody }>('/api/verify/start', async (request, reply) => {
    const { phone } = request.body;
    if (!phone) return reply.status(400).send({ error: 'phone is required' });

    const lookup = await lookupPhone(phone);
    if (!lookup.valid) {
      return reply.status(400).send({ error: 'Invalid phone number. Please include country code (e.g. +61...)' });
    }

    await startVerification(lookup.formatted);
    return { formatted: lookup.formatted };
  });

  app.post<{ Body: CheckBody }>('/api/verify/check', async (request, reply) => {
    const { phone, code } = request.body;
    if (!phone || !code) return reply.status(400).send({ error: 'phone and code are required' });

    const approved = await checkVerification(phone, code);
    if (!approved) {
      return reply.status(400).send({ error: 'Invalid or expired code. Try again.' });
    }

    return { verified: true };
  });
}
```

- [ ] **Step 3: Add verifyServiceSid to config**

Add to `packages/backend/src/config.ts`:
```typescript
verifyServiceSid: requireEnv('TWILIO_VERIFY_SERVICE_SID'),
```

Add to `.env.example`:
```bash
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 4: Register routes in index.ts**

```typescript
import { verifyRoutes } from './routes/verify.js';
await app.register(verifyRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/services/verify.ts packages/backend/src/routes/verify.ts packages/backend/src/config.ts .env.example
git commit -m "feat: add Twilio Lookup + Verify endpoints for phone validation and OTP"
```

---

### Task 4: Registration endpoint

**Files:**
- Create: `packages/backend/src/routes/register.ts`
- Create: `packages/backend/src/services/messaging.ts`

- [ ] **Step 1: Create messaging service**

```typescript
// packages/backend/src/services/messaging.ts
import Twilio from 'twilio';
import { config } from '../config.js';
import type { Participant } from '@twilio-preso/shared';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

export async function sendWelcomeSms(participant: Participant): Promise<void> {
  await client.messages.create({
    to: participant.phone,
    messagingServiceSid: config.twilio.messagingServiceSid,
    body: `Welcome to SIGNAL, ${participant.name}! You're now part of the live demo. Keep your phone handy — we'll be in touch. 🎉`,
  });
}

export async function sendSmsToParticipant(phone: string, body: string): Promise<void> {
  await client.messages.create({
    to: phone,
    messagingServiceSid: config.twilio.messagingServiceSid,
    body,
  });
}

export async function sendSmsToAll(participants: Participant[], bodyFn: (p: Participant) => string): Promise<void> {
  await Promise.allSettled(
    participants.map((p) => sendSmsToParticipant(p.phone, bodyFn(p)))
  );
}
```

- [ ] **Step 2: Create registration route**

```typescript
// packages/backend/src/routes/register.ts
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { addParticipant, publishEvent, generateSyncToken } from '../services/sync.js';
import { sendWelcomeSms } from '../services/messaging.js';
import type { Participant, ParticipantJoinedEvent } from '@twilio-preso/shared';

interface RegisterBody {
  name: string;
  phone: string;
  company?: string;
  role?: string;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RegisterBody }>('/api/register', async (request, reply) => {
    const { name, phone, company, role } = request.body;

    if (!name || !phone) {
      return reply.status(400).send({ error: 'name and phone are required' });
    }

    const participant: Participant = {
      id: randomUUID(),
      name,
      phone,
      company,
      role,
      registeredAt: Date.now(),
      responses: {},
    };

    await addParticipant(participant);

    const joinEvent: ParticipantJoinedEvent = {
      type: 'participant-joined',
      participantId: participant.id,
      name: participant.name,
      timestamp: Date.now(),
    };
    await publishEvent(joinEvent);

    // Send welcome SMS (fire and forget)
    sendWelcomeSms(participant).catch((err) => {
      console.error('Failed to send welcome SMS:', err.message);
    });

    // Return a Sync token for this participant
    const token = generateSyncToken(participant.id);

    return { participantId: participant.id, token };
  });
}
```

- [ ] **Step 3: Register route in index.ts**

Add to imports and registration:

```typescript
import { registerRoutes } from './routes/register.js';
// ...
await app.register(registerRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/services/messaging.ts packages/backend/src/routes/register.ts packages/backend/src/index.ts
git commit -m "feat: add audience registration with SMS welcome and Sync stream event"
```

---

### Task 4: Demo trigger routes

**Files:**
- Create: `packages/backend/src/routes/trigger.ts`
- Create: `packages/backend/src/services/voice.ts`

- [ ] **Step 1: Create voice service**

```typescript
// packages/backend/src/services/voice.ts
import Twilio from 'twilio';
import { config } from '../config.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

export async function initiateAgentCall(toPhone: string, presenterPhone: string): Promise<string> {
  const call = await client.calls.create({
    to: toPhone,
    from: config.twilio.phoneNumber,
    twiml: `<Response>
      <Say voice="Google.en-AU-Neural2-B">Hello! I'm an AI assistant from Twilio. I understand you have a question about customer engagement. Let me help you with that, and if needed, I'll connect you with a specialist.</Say>
      <Pause length="3"/>
      <Say voice="Google.en-AU-Neural2-B">Let me transfer you to our specialist now.</Say>
      <Dial>${presenterPhone}</Dial>
    </Response>`,
  });
  return call.sid;
}
```

- [ ] **Step 2: Create trigger routes**

```typescript
// packages/backend/src/routes/trigger.ts
import type { FastifyInstance } from 'fastify';
import { getAllParticipants, getParticipant } from '../services/sync.js';
import { sendSmsToAll, sendSmsToParticipant } from '../services/messaging.js';
import { initiateAgentCall } from '../services/voice.js';

interface TriggerBody {
  triggerId: string;
  targetParticipantId?: string;
}

export async function triggerRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: TriggerBody }>('/api/trigger', async (request, reply) => {
    const { triggerId, targetParticipantId } = request.body;
    const participants = await getAllParticipants();

    switch (triggerId) {
      case 'sms-patience': {
        await sendSmsToAll(participants, () =>
          `You've been on hold for 7 minutes. Still waiting... 😤\n\nThis is what your customers feel every day. — Twilio SIGNAL Demo`
        );
        return { sent: participants.length };
      }

      case 'sms-orchestrator': {
        await sendSmsToAll(participants, (p) =>
          `Hey ${p.name}, following up from our earlier message. Notice how this conversation continued seamlessly across channels? That's Conversation Orchestrator. — Twilio`
        );
        return { sent: participants.length };
      }

      case 'sms-memory': {
        await sendSmsToAll(participants, (p) => {
          const challengeResponse = Object.values(p.responses).find((r) => r.stageIndex === 8);
          const challenge = challengeResponse?.value || 'customer experience';
          return `Hey ${p.name}, you said "${challenge}" was your biggest challenge. We remembered — no database lookup, no asking again. That's Conversation Memory. — Twilio`;
        });
        return { sent: participants.length };
      }

      case 'voice-agent-connect': {
        if (!targetParticipantId) {
          return reply.status(400).send({ error: 'targetParticipantId required for voice trigger' });
        }
        const participant = await getParticipant(targetParticipantId);
        if (!participant) {
          return reply.status(404).send({ error: 'participant not found' });
        }
        const presenterPhone = process.env.PRESENTER_PHONE || '+61400000000';
        const callSid = await initiateAgentCall(participant.phone, presenterPhone);
        return { callSid };
      }

      case 'voice-mass-outbound': {
        // Mass outbound call to ALL participants with AMD
        // Use ConversationRelay if configured, otherwise fallback to static TwiML bot
        const useRelay = !!process.env.CONVERSATION_RELAY_URL;
        const twimlUrl = useRelay
          ? `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/voice/conversation-relay`
          : `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/voice/demo-bot`;

        const calls = await Promise.allSettled(
          participants.map((p) =>
            client.calls.create({
              to: p.phone,
              from: config.twilio.phoneNumber,
              machineDetection: 'Enable',
              url: twimlUrl,
            })
          )
        );
        const succeeded = calls.filter((c) => c.status === 'fulfilled').length;
        return { called: succeeded, total: participants.length, mode: useRelay ? 'conversation-relay' : 'static-twiml' };
      }

      case 'sms-closing': {
        await sendSmsToAll(participants, (p) => {
          const responses = Object.values(p.responses);
          const pollResponse = responses.find((r) => r.stageIndex === 15);
          const excited = pollResponse?.value || 'our platform';
          return `Thanks for being part of the magic, ${p.name}! You showed interest in ${excited}. Let's keep this conversation going: twil.io/signal-apj\n\nletsGoMichelangeloMode(); — Twilio`;
        });
        return { sent: participants.length };
      }

      default:
        return reply.status(400).send({ error: `Unknown trigger: ${triggerId}` });
    }
  });
}
```

- [ ] **Step 3: Register in index.ts**

```typescript
import { triggerRoutes } from './routes/trigger.js';
// ...
await app.register(triggerRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/services/voice.ts packages/backend/src/routes/trigger.ts packages/backend/src/index.ts
git commit -m "feat: add demo trigger routes for SMS patience, memory, orchestrator, voice, and closing"
```
