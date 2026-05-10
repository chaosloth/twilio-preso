# Phase 4: Presenter Core — 3D Engine & Navigation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Build the core 3D presentation engine: camera spline system, stage framework, keyboard navigation, Sync connection, and post-processing pipeline.

**Architecture:** R3F Canvas with a CameraController that follows a CatmullRom spline. Stages are lazy-loaded React components. Navigation advances the camera to the next waypoint.

**Tech Stack:** TypeScript, React Three Fiber, drei, GSAP, Zustand, Twilio Sync SDK

---

### Task 1: Camera spline system

**Files:**
- Create: `packages/presenter/src/components/Camera.tsx`

- [ ] **Step 1: Create camera controller with spline navigation**

```tsx
// packages/presenter/src/components/Camera.tsx
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CatmullRomCurve3, Vector3 } from 'three';
import gsap from 'gsap';
import { usePresenterStore } from '../store';
import { TOTAL_STAGES } from '@twilio-preso/shared';

const STAGE_SPACING = 20;

export function Camera() {
  const { camera } = useThree();
  const currentStageIndex = usePresenterStore((s) => s.currentStageIndex);
  const prevIndex = useRef(0);
  const progress = useRef({ value: 0 });

  const waypoints = useMemo(() => {
    return Array.from({ length: TOTAL_STAGES }, (_, i) => new Vector3(0, 0, -i * STAGE_SPACING));
  }, []);

  const curve = useMemo(() => {
    return new CatmullRomCurve3(waypoints, false, 'catmullrom', 0.5);
  }, [waypoints]);

  // Animate camera when stage changes
  useMemo(() => {
    if (currentStageIndex === prevIndex.current) return;

    const fromT = prevIndex.current / (TOTAL_STAGES - 1);
    const toT = currentStageIndex / (TOTAL_STAGES - 1);

    gsap.to(progress.current, {
      value: toT,
      duration: 1.5,
      ease: 'power2.inOut',
    });

    prevIndex.current = currentStageIndex;
  }, [currentStageIndex]);

  useFrame(() => {
    const point = curve.getPoint(progress.current.value);
    camera.position.lerp(point, 0.1);
    const lookTarget = point.clone().add(new Vector3(0, 0, -1));
    camera.lookAt(lookTarget);
  });

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/presenter/src/components/Camera.tsx
git commit -m "feat: add camera spline system with GSAP-driven transitions between stages"
```

---

### Task 2: Stage container and routing

**Files:**
- Create: `packages/presenter/src/components/Stage.tsx`

- [ ] **Step 1: Create stage container that positions stages along Z axis**

```tsx
// packages/presenter/src/components/Stage.tsx
import { Suspense, lazy } from 'react';
import { STAGES, TOTAL_STAGES } from '@twilio-preso/shared';

const STAGE_SPACING = 20;

// Lazy load all stage components
const stageComponents: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  opening: lazy(() => import('../stages/Stage01Opening')),
  speakers: lazy(() => import('../stages/Stage02Speakers')),
  'why-wonder': lazy(() => import('../stages/Stage03WhyWonder')),
  'story-arc': lazy(() => import('../stages/Stage04StoryArc')),
  'customer-nerves': lazy(() => import('../stages/Stage05CustomerNerves')),
  'patience-deficit': lazy(() => import('../stages/Stage06PatienceDeficit')),
  'think-channels': lazy(() => import('../stages/Stage07ThinkChannels')),
  siloes: lazy(() => import('../stages/Stage08Siloes')),
  'customers-are': lazy(() => import('../stages/Stage09CustomersAre')),
  orchestrating: lazy(() => import('../stages/Stage10Orchestrating')),
  'conversations-overview': lazy(() => import('../stages/Stage11ConversationsOverview')),
  orchestrator: lazy(() => import('../stages/Stage12Orchestrator')),
  memory: lazy(() => import('../stages/Stage13Memory')),
  intelligence: lazy(() => import('../stages/Stage14Intelligence')),
  'agent-connect': lazy(() => import('../stages/Stage15AgentConnect')),
  innovation: lazy(() => import('../stages/Stage16Innovation')),
  'never-easier': lazy(() => import('../stages/Stage17NeverEasier')),
  closing: lazy(() => import('../stages/Stage18Closing')),
};

export function StageContainer() {
  return (
    <group>
      {STAGES.map((stage, i) => {
        const StageComponent = stageComponents[stage.id];
        return (
          <group key={stage.id} position={[0, 0, -i * STAGE_SPACING]}>
            <Suspense fallback={null}>
              {StageComponent && <StageComponent />}
            </Suspense>
          </group>
        );
      })}
    </group>
  );
}
```

- [ ] **Step 2: Create placeholder stage component as template**

```tsx
// packages/presenter/src/stages/Stage01Opening.tsx
import { Text } from '@react-three/drei';

export default function Stage01Opening() {
  return (
    <group>
      <Text
        position={[0, 0, 0]}
        fontSize={0.5}
        color="#F22F46"
        anchorX="center"
        anchorY="middle"
      >
        Stage 1: Opening
      </Text>
    </group>
  );
}
```

Create the same placeholder pattern for stages 2-18 (each just displaying its name). These will be fleshed out in Phase 5.

- [ ] **Step 3: Commit**

```bash
git add packages/presenter/src/components/Stage.tsx packages/presenter/src/stages/
git commit -m "feat: add stage container with lazy-loaded stage components positioned along Z axis"
```

---

### Task 3: Keyboard navigation

**Files:**
- Create: `packages/presenter/src/hooks/useNavigation.ts`

- [ ] **Step 1: Create navigation hook**

```typescript
// packages/presenter/src/hooks/useNavigation.ts
import { useEffect } from 'react';
import { usePresenterStore } from '../store';
import { STAGES } from '@twilio-preso/shared';
import { updatePresentationState, publishStageAdvance } from '../sync';

export function useNavigation() {
  const advance = usePresenterStore((s) => s.advance);
  const back = usePresenterStore((s) => s.back);
  const currentStageIndex = usePresenterStore((s) => s.currentStageIndex);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          advance();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          back();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advance, back]);

  // Broadcast stage changes to Sync
  useEffect(() => {
    const stage = STAGES[currentStageIndex];
    publishStageAdvance(currentStageIndex);

    // Broadcast via BroadcastChannel for notes window
    const channel = new BroadcastChannel('presenter-sync');
    channel.postMessage({ type: 'stage-change', stageIndex: currentStageIndex });
    channel.close();
  }, [currentStageIndex]);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/presenter/src/hooks/useNavigation.ts
git commit -m "feat: add keyboard navigation hook with Sync broadcast and BroadcastChannel"
```

---

### Task 4: Presenter Sync client

**Files:**
- Create: `packages/presenter/src/sync.ts`

- [ ] **Step 1: Create presenter Sync client**

```typescript
// packages/presenter/src/sync.ts
import { SyncClient } from 'twilio-sync';
import type { AudienceResponseEvent, PresentationStateDoc, StageAdvanceEvent, InteractionPromptEvent, InteractionConfig } from '@twilio-preso/shared';
import { usePresenterStore } from './store';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const EVENT_STREAM = 'event-stream';
const PRESENTATION_STATE_DOC = 'presentation-state';
const AGGREGATE_RESULTS_DOC = 'aggregate-results';

let syncClient: SyncClient | null = null;

export async function initPresenterSync(): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/token?identity=presenter`);
  const { token } = await res.json();

  syncClient = new SyncClient(token);

  // Subscribe to event stream for audience responses
  const stream = await syncClient.stream(EVENT_STREAM);
  stream.on('messagePublished', (event) => {
    const data = event.message.data;
    if (data.type === 'audience-response') {
      usePresenterStore.getState().addResponse(data as AudienceResponseEvent);
    } else if (data.type === 'participant-joined') {
      const store = usePresenterStore.getState();
      store.setTotalParticipants(store.totalParticipants + 1);
    }
  });

  // Subscribe to presentation state document
  const stateDoc = await syncClient.document(PRESENTATION_STATE_DOC);
  stateDoc.on('updated', (event) => {
    const data = event.data as PresentationStateDoc;
    usePresenterStore.getState().setTotalParticipants(data.totalParticipants);
  });

  // Subscribe to aggregate results
  const resultsDoc = await syncClient.document(AGGREGATE_RESULTS_DOC);
  resultsDoc.on('updated', (event) => {
    usePresenterStore.getState().setAggregateResults(event.data as any);
  });
}

export async function publishStageAdvance(stageIndex: number): Promise<void> {
  if (!syncClient) return;
  const stream = await syncClient.stream(EVENT_STREAM);
  const event: StageAdvanceEvent = { type: 'stage-advance', stageIndex, timestamp: Date.now() };
  await stream.publishMessage({ data: event });
}

export async function publishInteractionPrompt(interaction: InteractionConfig): Promise<void> {
  if (!syncClient) return;
  const stream = await syncClient.stream(EVENT_STREAM);
  const event: InteractionPromptEvent = { type: 'interaction-prompt', interaction, timestamp: Date.now() };
  await stream.publishMessage({ data: event });
}

export async function triggerDemo(triggerId: string, targetParticipantId?: string): Promise<void> {
  await fetch(`${BACKEND_URL}/api/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ triggerId, targetParticipantId }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/presenter/src/sync.ts
git commit -m "feat: add presenter Sync client with stream subscriptions and trigger functions"
```

---

### Task 5: Post-processing pipeline

**Files:**
- Create: `packages/presenter/src/components/PostProcessing.tsx`

- [ ] **Step 1: Create post-processing component**

```tsx
// packages/presenter/src/components/PostProcessing.tsx
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';

export function PostProcessing() {
  return (
    <EffectComposer>
      <Bloom
        intensity={0.8}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <Vignette
        offset={0.3}
        darkness={0.6}
        blendFunction={BlendFunction.NORMAL}
      />
      <ChromaticAberration
        offset={new Vector2(0.0005, 0.0005)}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/presenter/src/components/PostProcessing.tsx
git commit -m "feat: add post-processing pipeline with bloom, vignette, and chromatic aberration"
```

---

### Task 6: Wire up App.tsx with all core systems

**Files:**
- Modify: `packages/presenter/src/App.tsx`

- [ ] **Step 1: Rewrite App.tsx with full core integration**

```tsx
// packages/presenter/src/App.tsx
import { Canvas } from '@react-three/fiber';
import { useEffect } from 'react';
import { Camera } from './components/Camera';
import { StageContainer } from './components/Stage';
import { PostProcessing } from './components/PostProcessing';
import { useNavigation } from './hooks/useNavigation';
import { initPresenterSync } from './sync';
import { usePresenterStore } from './store';

function Scene() {
  useNavigation();
  return (
    <>
      <Camera />
      <ambientLight intensity={0.2} />
      <StageContainer />
      <PostProcessing />
    </>
  );
}

function HUD() {
  const participants = usePresenterStore((s) => s.totalParticipants);
  const stageIndex = usePresenterStore((s) => s.currentStageIndex);
  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, color: 'white', fontFamily: 'monospace', opacity: 0.5, fontSize: 12 }}>
      Stage {stageIndex + 1}/18 | {participants} connected
    </div>
  );
}

export function App() {
  useEffect(() => {
    initPresenterSync().catch(console.error);
  }, []);

  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ width: '100vw', height: '100vh' }}
      >
        <color attach="background" args={['#0D1B2A']} />
        <Scene />
      </Canvas>
      <HUD />
    </>
  );
}
```

- [ ] **Step 2: Verify full presenter app runs with navigation**

```bash
pnpm --filter @twilio-preso/presenter dev
```

Expected: 3D scene with placeholder stage text. Arrow keys move camera between stages. HUD shows stage count.

- [ ] **Step 3: Commit**

```bash
git add packages/presenter/src/App.tsx
git commit -m "feat: wire presenter app with camera, stages, post-processing, and navigation"
```
