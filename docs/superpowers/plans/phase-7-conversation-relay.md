# Phase 7: ConversationRelay WebSocket Server

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Build a WebSocket server that handles Twilio ConversationRelay events for the mass outbound call demo. When every audience phone rings simultaneously, this server handles the AI conversation — looking up each caller by phone number and delivering a personalized, contextual voice experience.

**Architecture:** A WebSocket server that Twilio's ConversationRelay connects to. On connection, it receives the caller's phone number, looks them up in the Sync Map to get their name and responses, then uses an LLM to generate personalized conversational responses.

**Tech Stack:** TypeScript, Node.js, ws (WebSocket), Twilio SDK (for Sync Map lookup), Anthropic SDK (for LLM)

---

### Task 1: Scaffold ConversationRelay package

**Files:**
- Create: `packages/conversation-relay/package.json`
- Create: `packages/conversation-relay/tsconfig.json`
- Create: `packages/conversation-relay/src/config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@twilio-preso/conversation-relay",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "ws": "^8.18.0",
    "twilio": "^5.0.0",
    "@anthropic-ai/sdk": "^0.39.0",
    "dotenv": "^16.4.0",
    "@twilio-preso/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/ws": "^8.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022"]
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../shared" }]
}
```

- [ ] **Step 3: Create config.ts**

```typescript
// packages/conversation-relay/src/config.ts
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: parseInt(process.env.CONVERSATION_RELAY_PORT || '3003', 10),
  twilio: {
    accountSid: requireEnv('TWILIO_ACCOUNT_SID'),
    authToken: requireEnv('TWILIO_AUTH_TOKEN'),
    syncServiceSid: requireEnv('TWILIO_SYNC_SERVICE_SID'),
  },
  anthropic: {
    apiKey: requireEnv('ANTHROPIC_API_KEY'),
  },
} as const;
```

- [ ] **Step 4: Commit**

```bash
git add packages/conversation-relay/
git commit -m "feat: scaffold ConversationRelay WebSocket server package"
```

---

### Task 2: Participant lookup service

**Files:**
- Create: `packages/conversation-relay/src/participant.ts`

- [ ] **Step 1: Create participant lookup that queries Sync Map by phone number**

```typescript
// packages/conversation-relay/src/participant.ts
import Twilio from 'twilio';
import { config } from './config.js';
import type { Participant } from '@twilio-preso/shared';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);
const syncService = client.sync.v1.services(config.twilio.syncServiceSid);
const PARTICIPANTS_MAP = 'participants';

export async function lookupParticipantByPhone(phone: string): Promise<Participant | null> {
  try {
    // List all participants and find by phone number
    const items = await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems.list({ limit: 500 });
    const match = items.find((item) => {
      const data = item.data as Participant;
      return data.phone === phone || data.phone === normalizePhone(phone);
    });
    return match ? (match.data as Participant) : null;
  } catch (err) {
    console.error('Failed to lookup participant:', err);
    return null;
  }
}

function normalizePhone(phone: string): string {
  // Strip any formatting, keep + prefix
  return phone.replace(/[^\d+]/g, '');
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/conversation-relay/src/participant.ts
git commit -m "feat: add participant lookup by phone number from Sync Map"
```

---

### Task 3: LLM integration

**Files:**
- Create: `packages/conversation-relay/src/llm.ts`

- [ ] **Step 1: Create LLM service using Anthropic SDK**

```typescript
// packages/conversation-relay/src/llm.ts
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import type { Participant } from '@twilio-preso/shared';

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

export async function generateResponse(
  participant: Participant | null,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(participant);

  const messages = [
    ...conversationHistory,
    { role: 'user' as const, content: userMessage },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 150,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock?.text || "I'm sorry, I didn't catch that. Could you say that again?";
}

function buildSystemPrompt(participant: Participant | null): string {
  const name = participant?.name || 'friend';
  const challenge = participant?.responses?.[8]?.value || null;
  const excitedProduct = participant?.responses?.[15]?.value || null;

  let context = '';
  if (challenge) {
    context += `\nThey mentioned "${challenge}" as their biggest CX challenge during the presentation.`;
  }
  if (excitedProduct) {
    context += `\nThey expressed interest in ${excitedProduct}.`;
  }

  return `You are a friendly AI assistant at Twilio's SIGNAL World Tour event. You were just built live on stage in under 5 minutes — you're a demo of how fast Twilio enables developers to deploy voice AI agents.

You're speaking with ${name}.${context}

Keep responses SHORT (1-2 sentences max — this is a phone call). Be warm, impressed they're at the event, and briefly reference what you know about them. If they ask what you can do, explain you're a ConversationRelay-powered agent that can handle real-time voice conversations, look up customer data, and seamlessly hand off to humans.

End the conversation gracefully after 2-3 exchanges by thanking them and saying goodbye. Do not ramble. Sound natural and conversational.`;
}

export function generateGreeting(participant: Participant | null): string {
  const name = participant?.name || 'there';
  return `Hey ${name}! I'm the AI agent that was just built live on stage. Pretty cool that every phone in the room rang at once, right? What did you think of today's session?`;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/conversation-relay/src/llm.ts
git commit -m "feat: add LLM integration with Anthropic for personalized voice responses"
```

---

### Task 4: WebSocket handler for ConversationRelay events

**Files:**
- Create: `packages/conversation-relay/src/handler.ts`

- [ ] **Step 1: Create the ConversationRelay message handler**

```typescript
// packages/conversation-relay/src/handler.ts
import type { WebSocket } from 'ws';
import { lookupParticipantByPhone } from './participant.js';
import { generateResponse, generateGreeting } from './llm.js';
import type { Participant } from '@twilio-preso/shared';

interface ConversationRelayEvent {
  type: 'setup' | 'prompt' | 'interrupt' | 'dtmf' | 'error';
  token?: string;
  voicePrompt?: string;
  callerNumber?: string;
  callSid?: string;
  digit?: string;
  errorMessage?: string;
}

interface SessionState {
  participant: Participant | null;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  exchangeCount: number;
}

export async function handleConnection(ws: WebSocket): Promise<void> {
  const state: SessionState = {
    participant: null,
    conversationHistory: [],
    exchangeCount: 0,
  };

  ws.on('message', async (data) => {
    try {
      const event: ConversationRelayEvent = JSON.parse(data.toString());
      await handleEvent(ws, event, state);
    } catch (err) {
      console.error('Error handling ConversationRelay event:', err);
    }
  });

  ws.on('close', () => {
    console.log('ConversationRelay connection closed');
  });
}

async function handleEvent(
  ws: WebSocket,
  event: ConversationRelayEvent,
  state: SessionState
): Promise<void> {
  switch (event.type) {
    case 'setup': {
      // Lookup participant by their phone number
      if (event.callerNumber) {
        state.participant = await lookupParticipantByPhone(event.callerNumber);
        console.log(`Call connected: ${event.callerNumber} → ${state.participant?.name || 'unknown'}`);
      }

      // Send initial greeting
      const greeting = generateGreeting(state.participant);
      state.conversationHistory.push({ role: 'assistant', content: greeting });
      sendResponse(ws, greeting);
      break;
    }

    case 'prompt': {
      // User said something
      const userMessage = event.voicePrompt || '';
      state.exchangeCount++;

      // After 3 exchanges, wrap up
      if (state.exchangeCount >= 3) {
        const farewell = `It was great chatting with you${state.participant?.name ? `, ${state.participant.name}` : ''}! Enjoy the rest of SIGNAL. Goodbye!`;
        state.conversationHistory.push({ role: 'user', content: userMessage });
        state.conversationHistory.push({ role: 'assistant', content: farewell });
        sendResponse(ws, farewell, true);
        return;
      }

      // Generate LLM response
      const response = await generateResponse(
        state.participant,
        state.conversationHistory,
        userMessage
      );

      state.conversationHistory.push({ role: 'user', content: userMessage });
      state.conversationHistory.push({ role: 'assistant', content: response });
      sendResponse(ws, response);
      break;
    }

    case 'interrupt': {
      // User interrupted — acknowledge and stop current response
      console.log('User interrupted');
      break;
    }

    case 'dtmf': {
      // DTMF tone detected
      console.log(`DTMF: ${event.digit}`);
      break;
    }

    case 'error': {
      console.error('ConversationRelay error:', event.errorMessage);
      break;
    }
  }
}

function sendResponse(ws: WebSocket, text: string, hangup = false): void {
  const message: Record<string, unknown> = {
    type: 'text',
    token: text,
    last: true,
  };

  if (hangup) {
    message.handoff = { type: 'hangup' };
  }

  ws.send(JSON.stringify(message));
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/conversation-relay/src/handler.ts
git commit -m "feat: add ConversationRelay WebSocket event handler with participant lookup"
```

---

### Task 5: WebSocket server entry point

**Files:**
- Create: `packages/conversation-relay/src/index.ts`

- [ ] **Step 1: Create the WebSocket server**

```typescript
// packages/conversation-relay/src/index.ts
import 'dotenv/config';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { handleConnection } from './handler.js';

const wss = new WebSocketServer({ port: config.port });

wss.on('connection', (ws, req) => {
  console.log(`New ConversationRelay connection from ${req.socket.remoteAddress}`);
  handleConnection(ws);
});

wss.on('listening', () => {
  console.log(`ConversationRelay server running on ws://localhost:${config.port}`);
});
```

- [ ] **Step 2: Update root .env.example with new vars**

Add to .env.example:
```bash
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CONVERSATION_RELAY_PORT=3003
CONVERSATION_RELAY_URL=wss://your-domain.com:3003
```

- [ ] **Step 3: Update root package.json dev script to include conversation-relay**

Add to root package.json scripts:
```json
"dev:relay": "pnpm --filter @twilio-preso/conversation-relay dev"
```

Update the `dev` script to include it:
```json
"dev": "pnpm run --parallel dev:backend dev:presenter dev:audience dev:relay"
```

- [ ] **Step 4: Verify it compiles**

```bash
pnpm install
pnpm --filter @twilio-preso/conversation-relay typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/conversation-relay/src/index.ts .env.example package.json pnpm-lock.yaml
git commit -m "feat: add ConversationRelay WebSocket server entry point"
```
