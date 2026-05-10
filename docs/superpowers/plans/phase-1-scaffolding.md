# Phase 1: Monorepo Scaffolding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Set up the monorepo with all three packages, shared types, TypeScript strict mode, and dev tooling so all subsequent phases have a working foundation.

**Architecture:** pnpm workspaces monorepo. Shared types package consumed by presenter, audience, and backend.

**Tech Stack:** pnpm, TypeScript 5.x (strict), Vite, React 19, Fastify, Tailwind CSS

---

### Task 1: Initialize monorepo root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Initialize git and create root package.json**

```bash
cd /Users/cconnolly/Development/twilio-preso
git init
```

```json
// package.json
{
  "name": "twilio-preso",
  "private": true,
  "scripts": {
    "dev:presenter": "pnpm --filter @twilio-preso/presenter dev",
    "dev:audience": "pnpm --filter @twilio-preso/audience dev",
    "dev:backend": "pnpm --filter @twilio-preso/backend dev",
    "dev": "pnpm run --parallel dev:backend dev:presenter dev:audience",
    "build": "pnpm --filter @twilio-preso/shared build && pnpm run --parallel build:apps",
    "build:apps": "pnpm --filter @twilio-preso/presenter build && pnpm --filter @twilio-preso/audience build && pnpm --filter @twilio-preso/backend build",
    "typecheck": "pnpm -r typecheck"
  }
}
```

- [ ] **Step 2: Create pnpm workspace config**

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Create base tsconfig**

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.env
.DS_Store
*.local
```

- [ ] **Step 5: Create .env.example**

```bash
# .env.example
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_SYNC_SERVICE_SID=ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
PRESENTER_PHONE=+61400000000
TWILIO_VOICE=Google.en-AU-Neural2-B
BACKEND_URL=http://localhost:3001
CONVERSATION_RELAY_URL=
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CONVERSATION_RELAY_PORT=3003
```

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .env.example
git commit -m "feat: initialize monorepo root with pnpm workspaces"
```

---

### Task 2: Create shared types package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/stages.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create shared package.json**

```json
// packages/shared/package.json
{
  "name": "@twilio-preso/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create shared tsconfig**

```json
// packages/shared/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create types.ts with Sync schemas and event payloads**

```typescript
// packages/shared/src/types.ts

// --- Audience ---
export interface Participant {
  id: string;
  name: string;
  phone: string;
  company?: string;
  role?: string;
  registeredAt: number;
  responses: Record<number, ParticipantResponse>;
}

export interface ParticipantResponse {
  stageIndex: number;
  type: InteractionType;
  value: string;
  timestamp: number;
}

// --- Interactions ---
export type InteractionType = 'poll' | 'text' | 'trigger' | 'sentiment';

export interface InteractionConfig {
  stageIndex: number;
  type: InteractionType;
  prompt: string;
  options?: string[]; // for polls
}

// --- Sync Document Schemas ---
export interface PresentationStateDoc {
  currentStageIndex: number;
  activeInteraction: InteractionConfig | null;
  totalParticipants: number;
  isLive: boolean;
}

export interface AggregateResultsDoc {
  stageIndex: number;
  type: InteractionType;
  results: Record<string, number>; // option -> count (polls) or word -> count (text)
  totalResponses: number;
}

// --- Sync Stream Events ---
export interface StageAdvanceEvent {
  type: 'stage-advance';
  stageIndex: number;
  timestamp: number;
}

export interface InteractionPromptEvent {
  type: 'interaction-prompt';
  interaction: InteractionConfig;
  timestamp: number;
}

export interface AudienceResponseEvent {
  type: 'audience-response';
  participantId: string;
  participantName: string;
  stageIndex: number;
  interactionType: InteractionType;
  value: string;
  timestamp: number;
}

export interface ParticipantJoinedEvent {
  type: 'participant-joined';
  participantId: string;
  name: string;
  timestamp: number;
}

export type SyncStreamEvent =
  | StageAdvanceEvent
  | InteractionPromptEvent
  | AudienceResponseEvent
  | ParticipantJoinedEvent;

// --- Twilio Demo Triggers ---
export interface SmsTrigger {
  type: 'sms';
  stageIndex: number;
  templateId: string;
}

export interface VoiceTrigger {
  type: 'voice';
  stageIndex: number;
  targetParticipantId: string;
}

export type DemoTrigger = SmsTrigger | VoiceTrigger;
```

- [ ] **Step 4: Create stages.ts with stage definitions**

```typescript
// packages/shared/src/stages.ts
import type { InteractionConfig } from './types.js';

export interface StageDefinition {
  index: number;
  id: string;
  title: string;
  act: 1 | 2 | 3 | 4;
  notes: string;
  interaction: InteractionConfig | null;
  demoTrigger?: 'sms-patience' | 'sms-orchestrator' | 'sms-memory' | 'intelligence-analysis' | 'voice-agent-connect' | 'sms-closing';
}

export const STAGES: StageDefinition[] = [
  // ACT 1
  { index: 0, id: 'opening', title: 'Opening / QR Registration', act: 1, notes: 'Welcome audience. QR code is displayed. Encourage scanning. Wait for registration count to build.', interaction: null },
  { index: 1, id: 'speakers', title: 'Speakers Intro', act: 1, notes: 'Introduce Nicholas and Christopher. Mention roles and the "Wonder" theme.', interaction: null },
  { index: 2, id: 'why-wonder', title: 'Why Wonder?', act: 1, notes: 'Technology once inspired awe. Wonder reconnects tech to imagination. Builders are the magic makers.', interaction: null },
  { index: 3, id: 'story-arc', title: 'Wonder Story Arc', act: 1, notes: 'Six parts of the story. Each speaker owns a chapter. Ideas stack over time.', interaction: null },

  // ACT 2
  { index: 4, id: 'customer-nerves', title: "Who's getting on customers' nerves?", act: 2, notes: 'Transition to the problem. Launch the poll. Wait for responses to build the 3D bar chart.', interaction: { stageIndex: 4, type: 'poll', prompt: 'What frustrates YOUR customers most?', options: ['Long wait times', 'Repeating information', 'Channel switching', 'No resolution'] } },
  { index: 5, id: 'patience-deficit', title: 'Patience Deficit', act: 2, notes: 'Trigger the SMS demo. Audience feels the frustration firsthand. Reference the Decoding Digital Patience report.', interaction: null, demoTrigger: 'sms-patience' },
  { index: 6, id: 'think-channels', title: 'Think in Channels', act: 2, notes: 'We have learned to think in channels. Three doors — each a separate silo.', interaction: null },
  { index: 7, id: 'siloes', title: 'The Result is Siloes', act: 2, notes: 'Doors slam. The environment fractures. Dramatic moment — let the visual do the work.', interaction: null },
  { index: 8, id: 'customers-are', title: 'Customers Are...', act: 2, notes: 'Launch text input. Ask for their biggest CX challenge. Watch the word cloud form in real-time.', interaction: { stageIndex: 8, type: 'text', prompt: 'In one word, describe your biggest CX challenge right now.' } },

  // ACT 3
  { index: 9, id: 'orchestrating', title: "You're Orchestrating the Journey", act: 3, notes: 'The turn. From chaos to order. The conductor metaphor. Red threads weave the islands together.', interaction: null },
  { index: 10, id: 'conversations-overview', title: 'Twilio Conversations Overview', act: 3, notes: 'The four pillars materialize. Hero reveal moment. Let the audience absorb each product.', interaction: null },
  { index: 11, id: 'orchestrator', title: 'Conversation Orchestrator', act: 3, notes: 'Trigger WhatsApp message. Shows cross-channel continuity — references the earlier SMS.', interaction: null, demoTrigger: 'sms-orchestrator' },
  { index: 12, id: 'memory', title: 'Conversation Memory', act: 3, notes: "Trigger personalized SMS using their name and their word from stage 9. The 'wow' moment.", interaction: null, demoTrigger: 'sms-memory' },
  { index: 13, id: 'intelligence', title: 'Conversation Intelligence', act: 3, notes: 'Show live analysis of the word cloud responses. Sentiment breakdown, intent clustering visualized in 3D.', interaction: null, demoTrigger: 'intelligence-analysis' },
  { index: 14, id: 'agent-connect', title: 'Agent Connect', act: 3, notes: 'Volunteer gets the AI voice call. It handles their question then hands off to you on stage. Pick up the phone dramatically.', interaction: null, demoTrigger: 'voice-agent-connect' },

  // ACT 4
  { index: 15, id: 'innovation', title: 'Innovation: Wild Ideas to Results', act: 4, notes: 'Launch final poll. Which product excites them most? Pillars glow proportionally.', interaction: { stageIndex: 15, type: 'poll', prompt: 'Which product are you most excited to explore?', options: ['Conversation Orchestrator', 'Conversation Memory', 'Conversation Intelligence', 'Agent Connect'] } },
  { index: 16, id: 'never-easier', title: "It's Never Been Easier", act: 4, notes: 'Show aggregate stats. How many people participated, how many messages sent. The presentation itself was the demo.', interaction: null },
  { index: 17, id: 'mass-call', title: 'Mass Outbound Call', act: 4, notes: "The big finale demo. Every phone in the room rings simultaneously — connected to the AI bot we just 'built' on stage. Maximum wow factor.", interaction: null, demoTrigger: 'voice-mass-outbound' },
  { index: 18, id: 'closing', title: 'letsGoMichelangeloMode();', act: 4, notes: 'Final SMS to all participants. Personalized follow-up. Thank the audience. QR for resources.', interaction: null, demoTrigger: 'sms-closing' },
];

export const TOTAL_STAGES = STAGES.length;
```

- [ ] **Step 5: Create index.ts barrel export**

```typescript
// packages/shared/src/index.ts
export * from './types.js';
export * from './stages.js';
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types package with Sync schemas and stage definitions"
```

---

### Task 3: Scaffold presenter app

**Files:**
- Create: `packages/presenter/package.json`
- Create: `packages/presenter/tsconfig.json`
- Create: `packages/presenter/vite.config.ts`
- Create: `packages/presenter/index.html`
- Create: `packages/presenter/src/main.tsx`
- Create: `packages/presenter/src/App.tsx`
- Create: `packages/presenter/src/store.ts`

- [ ] **Step 1: Create presenter package.json**

```json
// packages/presenter/package.json
{
  "name": "@twilio-preso/presenter",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@react-three/drei": "^9.117.0",
    "@react-three/fiber": "^8.17.0",
    "@react-three/postprocessing": "^2.16.0",
    "gsap": "^3.12.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": "^0.170.0",
    "troika-three-text": "^0.52.0",
    "twilio-sync": "^4.0.0",
    "zustand": "^5.0.0",
    "@twilio-preso/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/three": "^0.170.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create presenter tsconfig.json**

```json
// packages/presenter/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../shared" }]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
// packages/presenter/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
});
```

- [ ] **Step 4: Create index.html**

```html
<!-- packages/presenter/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Twilio SIGNAL — Wonder</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #0D1B2A; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create main.tsx and App.tsx**

```tsx
// packages/presenter/src/main.tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

```tsx
// packages/presenter/src/App.tsx
import { Canvas } from '@react-three/fiber';

export function App() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 60 }}
      gl={{ antialias: true, alpha: false }}
      style={{ width: '100vw', height: '100vh' }}
    >
      <color attach="background" args={['#0D1B2A']} />
      <ambientLight intensity={0.3} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#F22F46" />
      </mesh>
    </Canvas>
  );
}
```

- [ ] **Step 6: Create Zustand store**

```typescript
// packages/presenter/src/store.ts
import { create } from 'zustand';
import type { PresentationStateDoc, AggregateResultsDoc, AudienceResponseEvent } from '@twilio-preso/shared';
import { TOTAL_STAGES } from '@twilio-preso/shared';

interface PresenterStore {
  currentStageIndex: number;
  totalParticipants: number;
  activeInteraction: PresentationStateDoc['activeInteraction'];
  aggregateResults: AggregateResultsDoc | null;
  recentResponses: AudienceResponseEvent[];
  isLive: boolean;

  advance: () => void;
  back: () => void;
  goTo: (index: number) => void;
  setTotalParticipants: (count: number) => void;
  setActiveInteraction: (interaction: PresentationStateDoc['activeInteraction']) => void;
  setAggregateResults: (results: AggregateResultsDoc | null) => void;
  addResponse: (response: AudienceResponseEvent) => void;
  setLive: (live: boolean) => void;
}

export const usePresenterStore = create<PresenterStore>((set, get) => ({
  currentStageIndex: 0,
  totalParticipants: 0,
  activeInteraction: null,
  aggregateResults: null,
  recentResponses: [],
  isLive: false,

  advance: () => set((s) => ({ currentStageIndex: Math.min(s.currentStageIndex + 1, TOTAL_STAGES - 1) })),
  back: () => set((s) => ({ currentStageIndex: Math.max(s.currentStageIndex - 1, 0) })),
  goTo: (index) => set({ currentStageIndex: Math.max(0, Math.min(index, TOTAL_STAGES - 1)) }),
  setTotalParticipants: (count) => set({ totalParticipants: count }),
  setActiveInteraction: (interaction) => set({ activeInteraction: interaction }),
  setAggregateResults: (results) => set({ aggregateResults: results }),
  addResponse: (response) => set((s) => ({ recentResponses: [...s.recentResponses.slice(-50), response] })),
  setLive: (live) => set({ isLive: live }),
}));
```

- [ ] **Step 7: Verify it builds**

```bash
cd /Users/cconnolly/Development/twilio-preso
pnpm install
pnpm --filter @twilio-preso/presenter dev
```

Expected: Vite dev server starts on port 3000, browser shows a red cube on navy background.

- [ ] **Step 8: Commit**

```bash
git add packages/presenter/
git commit -m "feat: scaffold presenter app with R3F, Zustand, and basic 3D scene"
```

---

### Task 4: Scaffold audience app

**Files:**
- Create: `packages/audience/package.json`
- Create: `packages/audience/tsconfig.json`
- Create: `packages/audience/vite.config.ts`
- Create: `packages/audience/index.html`
- Create: `packages/audience/src/main.tsx`
- Create: `packages/audience/src/App.tsx`
- Create: `packages/audience/tailwind.config.ts`
- Create: `packages/audience/src/index.css`

- [ ] **Step 1: Create audience package.json**

```json
// packages/audience/package.json
{
  "name": "@twilio-preso/audience",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "twilio-sync": "^4.0.0",
    "@twilio-preso/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig, vite config, tailwind config**

```json
// packages/audience/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../shared" }]
}
```

```typescript
// packages/audience/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3002 },
});
```

```typescript
// packages/audience/tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'twilio-navy': '#0D1B2A',
        'twilio-red': '#F22F46',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Create index.html and entry files**

```html
<!-- packages/audience/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>SIGNAL — Join</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```css
/* packages/audience/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0D1B2A;
  color: white;
  font-family: system-ui, -apple-system, sans-serif;
}
```

```tsx
// packages/audience/src/main.tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
```

```tsx
// packages/audience/src/App.tsx
export function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">SIGNAL World Tour</h1>
        <p className="text-twilio-red mt-2">Audience app loading...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create postcss.config.js**

```javascript
// packages/audience/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Verify it builds**

```bash
pnpm install
pnpm --filter @twilio-preso/audience dev
```

Expected: Vite dev server on port 3002, shows "SIGNAL World Tour" heading with red subtitle.

- [ ] **Step 6: Commit**

```bash
git add packages/audience/
git commit -m "feat: scaffold audience app with React, Tailwind, and Twilio Sync"
```

---

### Task 5: Scaffold backend server

**Files:**
- Create: `packages/backend/package.json`
- Create: `packages/backend/tsconfig.json`
- Create: `packages/backend/src/index.ts`
- Create: `packages/backend/src/config.ts`

- [ ] **Step 1: Create backend package.json**

```json
// packages/backend/package.json
{
  "name": "@twilio-preso/backend",
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
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "twilio": "^5.0.0",
    "@twilio-preso/shared": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create backend tsconfig**

```json
// packages/backend/tsconfig.json
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
    syncServiceSid: requireEnv('TWILIO_SYNC_SERVICE_SID'),
    messagingServiceSid: requireEnv('TWILIO_MESSAGING_SERVICE_SID'),
    phoneNumber: requireEnv('TWILIO_PHONE_NUMBER'),
  },
} as const;
```

- [ ] **Step 4: Create index.ts server entry**

```typescript
// packages/backend/src/index.ts
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get('/health', async () => ({ status: 'ok' }));

await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`Backend running on http://localhost:${config.port}`);
```

- [ ] **Step 5: Add dotenv dependency**

```bash
cd /Users/cconnolly/Development/twilio-preso
pnpm --filter @twilio-preso/backend add dotenv
```

- [ ] **Step 6: Verify it starts (with dummy env)**

Create a `.env` file in the project root with test values, then:

```bash
pnpm --filter @twilio-preso/backend dev
```

Expected: Server starts on port 3001, `GET /health` returns `{"status":"ok"}`.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/
git commit -m "feat: scaffold backend server with Fastify and Twilio config"
```

---

### Task 6: Verify full monorepo works together

- [ ] **Step 1: Install all dependencies**

```bash
cd /Users/cconnolly/Development/twilio-preso
pnpm install
```

- [ ] **Step 2: Run typecheck across all packages**

```bash
pnpm typecheck
```

Expected: All packages pass TypeScript strict mode checks.

- [ ] **Step 3: Run all dev servers simultaneously**

```bash
pnpm dev
```

Expected: Three servers running — presenter on 3000, backend on 3001, audience on 3002.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve any cross-package type issues"
```
