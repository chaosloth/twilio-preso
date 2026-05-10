# Phase 7: Presenter Notes Window & Deployment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Build the presenter notes pop-out window (synced via BroadcastChannel) and configure cloud deployment for the backend + audience app.

**Architecture:** Notes window is a route within the presenter app, opened via window.open(). It receives stage updates via BroadcastChannel and displays notes, timer, and controls. Backend deploys to Railway/Fly.io.

**Tech Stack:** TypeScript, React, BroadcastChannel API, Docker, Railway

---

### Task 1: Presenter Notes window

**Files:**
- Create: `packages/presenter/src/notes/NotesWindow.tsx`
- Create: `packages/presenter/src/notes/NotesApp.tsx`
- Modify: `packages/presenter/src/App.tsx`

- [ ] **Step 1: Create NotesApp component**

```tsx
// packages/presenter/src/notes/NotesApp.tsx
import { useState, useEffect, useRef } from 'react';
import { STAGES } from '@twilio-preso/shared';

export function NotesApp() {
  const [stageIndex, setStageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [participantCount, setParticipantCount] = useState(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const channel = new BroadcastChannel('presenter-sync');
    channel.onmessage = (event) => {
      if (event.data.type === 'stage-change') {
        setStageIndex(event.data.stageIndex);
      }
      if (event.data.type === 'participants-update') {
        setParticipantCount(event.data.count);
      }
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentStage = STAGES[stageIndex];
  const nextStage = STAGES[stageIndex + 1];

  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;

  function handleGoTo(index: number) {
    const channel = new BroadcastChannel('presenter-sync');
    channel.postMessage({ type: 'go-to-stage', stageIndex: index });
    channel.close();
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, background: '#1a1a2e', color: 'white', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 14, opacity: 0.5 }}>PRESENTER NOTES</h1>
        <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
          <span style={{ color: '#F22F46' }}>{minutes}:{seconds.toString().padStart(2, '0')}</span>
          <span>{participantCount} participants</span>
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: '#F22F46', marginBottom: 4 }}>
          STAGE {stageIndex + 1} / {STAGES.length} — ACT {currentStage.act}
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 12 }}>
          {currentStage.title}
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: '#ccc' }}>
          {currentStage.notes}
        </p>
        {currentStage.interaction && (
          <div style={{ marginTop: 12, padding: 12, background: 'rgba(242,47,70,0.1)', borderRadius: 8, border: '1px solid rgba(242,47,70,0.3)' }}>
            <div style={{ fontSize: 12, color: '#F22F46', marginBottom: 4 }}>INTERACTION: {currentStage.interaction.type.toUpperCase()}</div>
            <div style={{ fontSize: 14 }}>{currentStage.interaction.prompt}</div>
          </div>
        )}
        {currentStage.demoTrigger && (
          <div style={{ marginTop: 8, padding: 12, background: 'rgba(100,149,237,0.1)', borderRadius: 8, border: '1px solid rgba(100,149,237,0.3)' }}>
            <div style={{ fontSize: 12, color: 'cornflowerblue' }}>DEMO TRIGGER: {currentStage.demoTrigger}</div>
          </div>
        )}
      </div>

      {nextStage && (
        <div style={{ marginBottom: 32, opacity: 0.6 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>NEXT UP</div>
          <div style={{ fontSize: 16 }}>{nextStage.title}</div>
        </div>
      )}

      <div style={{ borderTop: '1px solid #333', paddingTop: 16 }}>
        <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.5 }}>JUMP TO STAGE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {STAGES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => handleGoTo(i)}
              style={{
                width: 28,
                height: 28,
                border: i === stageIndex ? '2px solid #F22F46' : '1px solid #444',
                background: i === stageIndex ? 'rgba(242,47,70,0.2)' : 'transparent',
                color: 'white',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create notes window launcher**

```tsx
// packages/presenter/src/notes/NotesWindow.tsx
export function openNotesWindow() {
  const notesWindow = window.open(
    '/notes',
    'presenter-notes',
    'width=500,height=700,menubar=no,toolbar=no'
  );
  return notesWindow;
}
```

- [ ] **Step 3: Add notes route to the presenter app**

Update `packages/presenter/src/main.tsx`:

```tsx
// packages/presenter/src/main.tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { NotesApp } from './notes/NotesApp';

const isNotesRoute = window.location.pathname === '/notes';

createRoot(document.getElementById('root')!).render(
  isNotesRoute ? <NotesApp /> : <App />
);
```

- [ ] **Step 4: Add keyboard shortcut to open notes (N key)**

In `packages/presenter/src/hooks/useNavigation.ts`, add to the keydown handler:

```typescript
case 'n':
case 'N':
  if (!e.repeat) {
    const { openNotesWindow } = await import('../notes/NotesWindow');
    openNotesWindow();
  }
  break;
```

- [ ] **Step 5: Listen for go-to-stage commands from notes window**

In `packages/presenter/src/hooks/useNavigation.ts`, add:

```typescript
useEffect(() => {
  const channel = new BroadcastChannel('presenter-sync');
  channel.onmessage = (event) => {
    if (event.data.type === 'go-to-stage') {
      usePresenterStore.getState().goTo(event.data.stageIndex);
    }
  };
  return () => channel.close();
}, []);
```

- [ ] **Step 6: Commit**

```bash
git add packages/presenter/src/notes/ packages/presenter/src/main.tsx packages/presenter/src/hooks/useNavigation.ts
git commit -m "feat: add presenter notes pop-out window with BroadcastChannel sync"
```

---

### Task 2: Deployment configuration

**Files:**
- Create: `packages/backend/Dockerfile`
- Create: `packages/backend/fly.toml`
- Create: `packages/audience/vite.config.ts` (update for production build)
- Create: `scripts/deploy.sh`

- [ ] **Step 1: Create backend Dockerfile**

```dockerfile
# packages/backend/Dockerfile
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @twilio-preso/backend build

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Create fly.toml for Fly.io deployment**

```toml
# packages/backend/fly.toml
app = "twilio-preso-backend"
primary_region = "syd"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[env]
  PORT = "3001"
```

- [ ] **Step 3: Create deploy script**

```bash
#!/bin/bash
# scripts/deploy.sh
set -e

echo "Building audience app..."
pnpm --filter @twilio-preso/audience build

echo "Deploying backend to Fly.io..."
cd packages/backend
fly deploy

echo "Deploying audience static files..."
# Copy audience dist to backend's public folder or deploy to CDN
echo "Done! Update QR code URL to point to production."
```

- [ ] **Step 4: Add .gitignore for .superpowers directory**

```bash
echo ".superpowers/" >> /Users/cconnolly/Development/twilio-preso/.gitignore
```

- [ ] **Step 5: Commit**

```bash
chmod +x scripts/deploy.sh
git add packages/backend/Dockerfile packages/backend/fly.toml scripts/deploy.sh .gitignore
git commit -m "feat: add deployment config (Dockerfile, Fly.io, deploy script)"
```

---

### Task 3: End-to-end smoke test

- [ ] **Step 1: Start all services locally**

```bash
pnpm dev
```

- [ ] **Step 2: Verify the full flow**

1. Open presenter at http://localhost:3000 — 3D scene renders
2. Press N — notes window opens, synced to stage 1
3. Open audience at http://localhost:3002 — registration form appears
4. Register with test phone number
5. Verify welcome SMS received
6. Press Right Arrow on presenter — stage advances, notes update
7. Navigate to stage 5 (poll) — audience phone shows poll prompt
8. Submit a poll response — 3D bar chart updates on presenter
9. Navigate through remaining stages — verify demo triggers fire

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix: end-to-end integration fixes from smoke test"
```
