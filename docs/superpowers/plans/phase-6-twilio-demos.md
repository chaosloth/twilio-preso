# Phase 6: Live Twilio API Demo Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Wire up the presenter app to trigger Twilio demos at the right moments, handle audience response aggregation for Intelligence analysis, and manage the Agent Connect voice handoff flow.

**Architecture:** When the presenter advances to a stage with a `demoTrigger`, the app calls the backend trigger endpoint. Backend sends SMS/initiates calls via Twilio APIs. Responses flow back through Sync Streams.

**Tech Stack:** TypeScript, Twilio SDK, React Three Fiber

---

### Task 1: Auto-trigger demos on stage advance

**Files:**
- Create: `packages/presenter/src/hooks/useDemoTriggers.ts`

- [ ] **Step 1: Create hook that fires triggers on stage entry**

```typescript
// packages/presenter/src/hooks/useDemoTriggers.ts
import { useEffect, useRef } from 'react';
import { usePresenterStore } from '../store';
import { STAGES } from '@twilio-preso/shared';
import { triggerDemo, publishInteractionPrompt } from '../sync';

export function useDemoTriggers() {
  const currentStageIndex = usePresenterStore((s) => s.currentStageIndex);
  const lastTriggeredStage = useRef(-1);

  useEffect(() => {
    if (currentStageIndex === lastTriggeredStage.current) return;
    lastTriggeredStage.current = currentStageIndex;

    const stage = STAGES[currentStageIndex];

    // If stage has an interaction, publish the prompt
    if (stage.interaction) {
      publishInteractionPrompt(stage.interaction);
    }

    // If stage has a demo trigger, fire it
    if (stage.demoTrigger) {
      triggerDemo(stage.demoTrigger).catch((err) => {
        console.error(`Demo trigger failed for ${stage.demoTrigger}:`, err);
      });
    }
  }, [currentStageIndex]);
}
```

- [ ] **Step 2: Add hook to the Scene component in App.tsx**

In `packages/presenter/src/App.tsx`, inside the `Scene` component, add:

```tsx
import { useDemoTriggers } from './hooks/useDemoTriggers';

function Scene() {
  useNavigation();
  useDemoTriggers();
  // ... rest
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/presenter/src/hooks/useDemoTriggers.ts packages/presenter/src/App.tsx
git commit -m "feat: auto-trigger Twilio demos and interaction prompts on stage advance"
```

---

### Task 2: Audience response aggregation on backend

**Files:**
- Create: `packages/backend/src/services/aggregation.ts`
- Modify: `packages/backend/src/index.ts`

- [ ] **Step 1: Create aggregation service that listens to Sync Stream**

```typescript
// packages/backend/src/services/aggregation.ts
import Twilio from 'twilio';
import { config } from '../config.js';
import { updateAggregateResults, updateParticipant } from './sync.js';
import type { AggregateResultsDoc, AudienceResponseEvent } from '@twilio-preso/shared';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);
const syncService = client.sync.v1.services(config.twilio.syncServiceSid);

const currentResults: AggregateResultsDoc = {
  stageIndex: 0,
  type: 'poll',
  results: {},
  totalResponses: 0,
};

export async function startAggregationListener(): Promise<void> {
  // Subscribe to the event stream via Sync REST webhook or polling
  // For simplicity, use the Sync SDK's event listener pattern
  const stream = await syncService.syncStreams('event-stream').fetch();

  // Listen for new messages via webhook (configured in Twilio Console)
  // Or use a Sync SDK client subscription in the backend
  console.log('Aggregation listener ready. Stream SID:', stream.sid);
}

export function processAudienceResponse(event: AudienceResponseEvent): void {
  // Reset if new stage
  if (event.stageIndex !== currentResults.stageIndex) {
    currentResults.stageIndex = event.stageIndex;
    currentResults.type = event.interactionType;
    currentResults.results = {};
    currentResults.totalResponses = 0;
  }

  // Increment the response value
  const key = event.value;
  currentResults.results[key] = (currentResults.results[key] || 0) + 1;
  currentResults.totalResponses += 1;

  // Update the Sync document (debounced in production, immediate here)
  updateAggregateResults({ ...currentResults });

  // Store response on the participant record
  updateParticipant(event.participantId, {
    responses: { [event.stageIndex]: { stageIndex: event.stageIndex, type: event.interactionType, value: event.value, timestamp: event.timestamp } },
  }).catch(console.error);
}
```

- [ ] **Step 2: Add a webhook route for Sync Stream messages**

```typescript
// Add to packages/backend/src/routes/trigger.ts or create a new route file
// packages/backend/src/routes/webhook.ts
import type { FastifyInstance } from 'fastify';
import { processAudienceResponse } from '../services/aggregation.js';
import type { AudienceResponseEvent } from '@twilio-preso/shared';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/sync-webhook', async (request) => {
    const body = request.body as any;
    if (body?.data?.type === 'audience-response') {
      processAudienceResponse(body.data as AudienceResponseEvent);
    }
    return { ok: true };
  });
}
```

- [ ] **Step 3: Register webhook route in index.ts**

```typescript
import { webhookRoutes } from './routes/webhook.js';
await app.register(webhookRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/services/aggregation.ts packages/backend/src/routes/webhook.ts packages/backend/src/index.ts
git commit -m "feat: add audience response aggregation with Sync document updates"
```

---

### Task 3: Agent Connect voice flow

**Files:**
- Modify: `packages/backend/src/services/voice.ts`
- Create: `packages/backend/src/routes/voice-webhook.ts`

- [ ] **Step 1: Create voice webhook routes (Agent Connect + Mass Outbound Bot)**

```typescript
// packages/backend/src/routes/voice-webhook.ts
import type { FastifyInstance } from 'fastify';

export async function voiceWebhookRoutes(app: FastifyInstance): Promise<void> {
  // TwiML endpoint for the Agent Connect demo (single volunteer call)
  app.post('/api/voice/agent', async (request, reply) => {
    const voice = process.env.TWILIO_VOICE || 'Google.en-AU-Neural2-B';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">Hello! I'm an AI assistant from Twilio. I understand you're attending SIGNAL World Tour today. How can I help you explore our platform?</Say>
  <Pause length="5"/>
  <Say voice="${voice}">That's a great question. Let me connect you with our specialist Christopher who can dive deeper into that with you.</Say>
  <Dial>${process.env.PRESENTER_PHONE || '+61400000000'}</Dial>
</Response>`;

    reply.header('Content-Type', 'text/xml');
    return twiml;
  });

  // TwiML endpoint for mass outbound call — ConversationRelay mode (full AI conversation)
  app.post('/api/voice/conversation-relay', async (request, reply) => {
    const conversationRelayUrl = process.env.CONVERSATION_RELAY_URL || 'wss://localhost:3003';
    const voice = process.env.TWILIO_VOICE || 'Google.en-AU-Neural2-B';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay url="${conversationRelayUrl}" voice="${voice}" dtmfDetection="true" interruptible="true" />
  </Connect>
</Response>`;

    reply.header('Content-Type', 'text/xml');
    return twiml;
  });

  // TwiML endpoint for mass outbound call — static fallback mode (no ConversationRelay needed)
  app.post('/api/voice/demo-bot', async (request, reply) => {
    const voice = process.env.TWILIO_VOICE || 'Google.en-AU-Neural2-B';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">Hey there! You just experienced a mass outbound call from an AI agent that was built live, on stage, in under 5 minutes. That's the power of Twilio. Every phone in the room just rang simultaneously. Whether you're reaching 1 customer or 1000, Twilio scales with you. Thanks for being part of the magic today. See you at the next SIGNAL!</Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;

    reply.header('Content-Type', 'text/xml');
    return twiml;
  });
}
```

- [ ] **Step 2: Register route**

```typescript
import { voiceWebhookRoutes } from './routes/voice-webhook.js';
await app.register(voiceWebhookRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/routes/voice-webhook.ts packages/backend/src/index.ts
git commit -m "feat: add Agent Connect voice webhook with TwiML for AI-to-human handoff"
```
