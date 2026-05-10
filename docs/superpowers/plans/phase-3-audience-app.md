# Phase 3: Audience Mobile App

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Build the mobile web app that audience members access via QR code. Handles registration, connects to Twilio Sync, and displays interaction prompts pushed by the presenter.

**Architecture:** Lightweight React SPA. After registration, subscribes to a Sync Stream for prompts and renders the appropriate interaction UI.

**Tech Stack:** TypeScript, React 19, Vite, Tailwind CSS, Twilio Sync SDK

---

### Task 1: Sync client module

**Files:**
- Create: `packages/audience/src/sync.ts`

- [ ] **Step 1: Create Sync client wrapper**

```typescript
// packages/audience/src/sync.ts
import { SyncClient } from 'twilio-sync';
import type { InteractionConfig } from '@twilio-preso/shared';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const EVENT_STREAM = 'event-stream';

let syncClient: SyncClient | null = null;

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
  const stream = await client.stream(EVENT_STREAM);

  stream.on('messagePublished', (event) => {
    const data = event.message.data;
    if (data.type === 'interaction-prompt') {
      onInteraction(data.interaction);
    } else if (data.type === 'stage-advance') {
      onStageAdvance(data.stageIndex);
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
  const client = getSyncClient();
  const stream = await client.stream(EVENT_STREAM);

  await stream.publishMessage({
    data: {
      type: 'audience-response',
      participantId,
      participantName,
      stageIndex,
      interactionType,
      value,
      timestamp: Date.now(),
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/audience/src/sync.ts
git commit -m "feat: add audience Sync client with stream subscription and response publishing"
```

---

### Task 2: Registration page (Phone → Lookup → Verify OTP → Name)

**Files:**
- Create: `packages/audience/src/pages/Register.tsx`

- [ ] **Step 1: Create multi-step registration form (phone first, then OTP, then name)**

```tsx
// packages/audience/src/pages/Register.tsx
import { useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface RegisterProps {
  onRegistered: (participantId: string, name: string) => void;
}

type Step = 'phone' | 'otp' | 'name';

export function Register({ onRegistered }: RegisterProps) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/verify/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Invalid phone number');
      }

      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/verify/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Invalid code');
      }

      setStep('name');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, company }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Registration failed');
      }

      const { participantId } = await res.json();
      onRegistered(participantId, name);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Join the Experience</h1>
          <p className="text-gray-400 mt-2">SIGNAL World Tour 2026</p>
        </div>

        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <input
              type="tel"
              placeholder="Your mobile number (e.g. +61...)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-twilio-red text-lg"
            />
            {error && <p className="text-twilio-red text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-lg bg-twilio-red text-white font-bold text-lg disabled:opacity-50">
              {loading ? 'Verifying...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <p className="text-gray-400 text-sm text-center">We sent a code to {phone}</p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              autoFocus
              maxLength={6}
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-twilio-red text-center text-2xl tracking-widest"
            />
            {error && <p className="text-twilio-red text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-lg bg-twilio-red text-white font-bold text-lg disabled:opacity-50">
              {loading ? 'Checking...' : 'Verify'}
            </button>
          </form>
        )}

        {step === 'name' && (
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <p className="text-green-400 text-sm text-center mb-2">Phone verified!</p>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-twilio-red"
            />
            <input
              type="text"
              placeholder="Company (optional)"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-twilio-red"
            />
            {error && <p className="text-twilio-red text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-lg bg-twilio-red text-white font-bold text-lg disabled:opacity-50">
              {loading ? 'Joining...' : 'Join the Demo'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/audience/src/pages/Register.tsx
git commit -m "feat: add multi-step registration (phone → OTP verify → name)"
```

---

### Task 3: Interaction pages

**Files:**
- Create: `packages/audience/src/pages/Waiting.tsx`
- Create: `packages/audience/src/pages/Poll.tsx`
- Create: `packages/audience/src/pages/TextInput.tsx`
- Create: `packages/audience/src/pages/Trigger.tsx`
- Create: `packages/audience/src/pages/Sentiment.tsx`

- [ ] **Step 1: Create Waiting page**

```tsx
// packages/audience/src/pages/Waiting.tsx
export function Waiting({ name }: { name: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-twilio-red border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <h2 className="text-xl font-bold">You're in, {name}!</h2>
        <p className="text-gray-400 mt-2">Waiting for the next interaction...</p>
        <p className="text-gray-500 text-sm mt-4">Keep your phone handy</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Poll page**

```tsx
// packages/audience/src/pages/Poll.tsx
import { useState } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';

interface PollProps {
  interaction: InteractionConfig;
  onSubmit: (value: string) => void;
}

export function Poll({ interaction, onSubmit }: PollProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSelect(option: string) {
    if (submitted) return;
    setSelected(option);
    setSubmitted(true);
    onSubmit(option);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold text-center mb-6">{interaction.prompt}</h2>
      <div className="w-full max-w-sm space-y-3">
        {interaction.options?.map((option) => (
          <button
            key={option}
            onClick={() => handleSelect(option)}
            className={`w-full py-4 px-4 rounded-lg text-left font-medium transition-all ${
              selected === option
                ? 'bg-twilio-red text-white scale-[1.02]'
                : submitted
                  ? 'bg-white/5 text-gray-500'
                  : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      {submitted && (
        <p className="text-gray-400 mt-6 text-sm">Response recorded!</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create TextInput page**

```tsx
// packages/audience/src/pages/TextInput.tsx
import { useState } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';

interface TextInputProps {
  interaction: InteractionConfig;
  onSubmit: (value: string) => void;
}

export function TextInput({ interaction, onSubmit }: TextInputProps) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    onSubmit(value.trim());
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold text-center mb-6">{interaction.prompt}</h2>
      {!submitted ? (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type your answer..."
            autoFocus
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-twilio-red text-lg"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-twilio-red text-white font-bold"
          >
            Send
          </button>
        </form>
      ) : (
        <div className="text-center">
          <p className="text-2xl font-bold text-twilio-red">{value}</p>
          <p className="text-gray-400 mt-2">Sent!</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create Trigger page**

```tsx
// packages/audience/src/pages/Trigger.tsx
import { useState } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';

interface TriggerProps {
  interaction: InteractionConfig;
  onSubmit: (value: string) => void;
}

export function Trigger({ interaction, onSubmit }: TriggerProps) {
  const [triggered, setTriggered] = useState(false);

  function handleTrigger() {
    setTriggered(true);
    onSubmit('ready');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold text-center mb-6">{interaction.prompt}</h2>
      {!triggered ? (
        <button
          onClick={handleTrigger}
          className="px-8 py-4 rounded-full bg-twilio-red text-white font-bold text-lg animate-pulse"
        >
          I'm Ready
        </button>
      ) : (
        <p className="text-gray-400">Something's coming to your phone...</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create Sentiment page**

```tsx
// packages/audience/src/pages/Sentiment.tsx
import { useState } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';

interface SentimentProps {
  interaction: InteractionConfig;
  onSubmit: (value: string) => void;
}

const EMOJIS = ['😤', '😐', '🙂', '😃', '🤩'];

export function Sentiment({ interaction, onSubmit }: SentimentProps) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleSelect(emoji: string) {
    if (selected) return;
    setSelected(emoji);
    onSubmit(emoji);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold text-center mb-8">{interaction.prompt}</h2>
      <div className="flex gap-4">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleSelect(emoji)}
            className={`text-4xl p-2 rounded-lg transition-all ${
              selected === emoji ? 'scale-150 bg-white/10' : selected ? 'opacity-30' : 'hover:scale-125'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
      {selected && <p className="text-gray-400 mt-6">Thanks!</p>}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/audience/src/pages/
git commit -m "feat: add all audience interaction pages (poll, text, trigger, sentiment, waiting)"
```

---

### Task 4: Wire up App with routing logic

**Files:**
- Modify: `packages/audience/src/App.tsx`

- [ ] **Step 1: Rewrite App.tsx with full flow**

```tsx
// packages/audience/src/App.tsx
import { useState, useEffect, useCallback } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';
import { initSync, subscribeToEvents, publishResponse } from './sync';
import { Register } from './pages/Register';
import { Waiting } from './pages/Waiting';
import { Poll } from './pages/Poll';
import { TextInput } from './pages/TextInput';
import { Trigger } from './pages/Trigger';
import { Sentiment } from './pages/Sentiment';

type AppState = 'register' | 'waiting' | 'interaction';

export function App() {
  const [state, setState] = useState<AppState>('register');
  const [participantId, setParticipantId] = useState('');
  const [name, setName] = useState('');
  const [activeInteraction, setActiveInteraction] = useState<InteractionConfig | null>(null);

  const handleRegistered = useCallback(async (id: string, participantName: string) => {
    setParticipantId(id);
    setName(participantName);
    setState('waiting');

    await initSync(id);
    await subscribeToEvents(
      (interaction) => {
        setActiveInteraction(interaction);
        setState('interaction');
      },
      () => {
        // Stage advance clears current interaction
        setActiveInteraction(null);
        setState('waiting');
      }
    );
  }, []);

  const handleResponse = useCallback((value: string) => {
    if (!activeInteraction) return;
    publishResponse(
      participantId,
      name,
      activeInteraction.stageIndex,
      activeInteraction.type,
      value
    );
  }, [participantId, name, activeInteraction]);

  if (state === 'register') {
    return <Register onRegistered={handleRegistered} />;
  }

  if (state === 'waiting' || !activeInteraction) {
    return <Waiting name={name} />;
  }

  switch (activeInteraction.type) {
    case 'poll':
      return <Poll interaction={activeInteraction} onSubmit={handleResponse} />;
    case 'text':
      return <TextInput interaction={activeInteraction} onSubmit={handleResponse} />;
    case 'trigger':
      return <Trigger interaction={activeInteraction} onSubmit={handleResponse} />;
    case 'sentiment':
      return <Sentiment interaction={activeInteraction} onSubmit={handleResponse} />;
    default:
      return <Waiting name={name} />;
  }
}
```

- [ ] **Step 2: Verify the audience app runs and shows registration form**

```bash
pnpm --filter @twilio-preso/audience dev
```

Expected: Registration form appears on localhost:3002.

- [ ] **Step 3: Commit**

```bash
git add packages/audience/src/App.tsx
git commit -m "feat: wire audience app with Sync subscription and interaction routing"
```
