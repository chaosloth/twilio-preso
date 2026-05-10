# Twilio SIGNAL Interactive Presentation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each phase is a separate file — complete them in order.

**Goal:** Build a cinematic Three.js presentation with real-time audience participation via Twilio Sync, demoing Twilio Conversations products to contact centre professionals.

**Architecture:** Monorepo with three packages (presenter, audience, backend) sharing TypeScript types. Twilio Sync Streams broadcast events between all clients. React Three Fiber renders the 3D stage. Backend orchestrates Twilio API calls.

**Tech Stack:** TypeScript, React 19, Vite, React Three Fiber, GSAP, Zustand, Tailwind CSS, Node.js, Fastify, Twilio SDK (Sync, SMS, Voice, Conversations)

---

## Phases

Execute these in order. Each phase produces working, testable software.

| Phase | File | Description |
|-------|------|-------------|
| 1 | [phase-1-scaffolding.md](./phase-1-scaffolding.md) | Monorepo setup, shared types, dev tooling |
| 2 | [phase-2-backend.md](./phase-2-backend.md) | Backend server, Twilio Sync integration, token endpoint |
| 3 | [phase-3-audience-app.md](./phase-3-audience-app.md) | Audience mobile web app, registration, interaction UI |
| 4 | [phase-4-presenter-core.md](./phase-4-presenter-core.md) | 3D engine, camera system, stage framework, navigation |
| 5 | [phase-5-stages.md](./phase-5-stages.md) | All 18 stage scenes (content, visuals, animations) |
| 6 | [phase-6-twilio-demos.md](./phase-6-twilio-demos.md) | Live Twilio API demos (SMS, Voice, Intelligence, Memory) |
| 7 | [phase-7-conversation-relay.md](./phase-7-conversation-relay.md) | ConversationRelay WebSocket server for mass outbound call AI bot |
| 8 | [phase-8-notes-deploy.md](./phase-8-notes-deploy.md) | Presenter notes window, deployment config |

## File Structure

```
twilio-preso/
├── packages/
│   ├── shared/                    # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── types.ts           # Sync document schemas, event payloads
│   │   │   ├── stages.ts          # Stage definitions (content, config)
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── presenter/                 # 3D presentation app
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── store.ts           # Zustand store
│   │   │   ├── sync.ts            # Twilio Sync client
│   │   │   ├── components/
│   │   │   │   ├── Stage.tsx      # Stage container/router
│   │   │   │   ├── Camera.tsx     # Camera spline system
│   │   │   │   ├── PostProcessing.tsx
│   │   │   │   └── HUD.tsx        # Registration count overlay
│   │   │   ├── stages/            # One file per stage
│   │   │   │   ├── Stage01Opening.tsx
│   │   │   │   ├── Stage02Speakers.tsx
│   │   │   │   ├── ...
│   │   │   │   └── Stage18Closing.tsx
│   │   │   ├── objects/           # Reusable 3D objects
│   │   │   │   ├── TwilioGem.tsx
│   │   │   │   ├── ParticleField.tsx
│   │   │   │   ├── FloatingText.tsx
│   │   │   │   ├── BarChart3D.tsx
│   │   │   │   ├── WordCloud3D.tsx
│   │   │   │   └── GlowingPillar.tsx
│   │   │   ├── notes/             # Presenter notes (pop-out)
│   │   │   │   └── NotesWindow.tsx
│   │   │   └── assets/
│   │   ├── public/
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   ├── audience/                  # Mobile audience app
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── sync.ts            # Twilio Sync client
│   │   │   ├── pages/
│   │   │   │   ├── Register.tsx
│   │   │   │   ├── Waiting.tsx
│   │   │   │   ├── Poll.tsx
│   │   │   │   ├── TextInput.tsx
│   │   │   │   ├── Trigger.tsx
│   │   │   │   └── Sentiment.tsx
│   │   │   └── components/
│   │   │       └── Layout.tsx
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   ├── backend/                   # Fastify server
│   │   ├── src/
│   │   │   ├── index.ts           # Server entry
│   │   │   ├── routes/
│   │   │   │   ├── token.ts       # Sync token endpoint
│   │   │   │   ├── register.ts    # Audience registration
│   │   │   │   ├── verify.ts      # Twilio Lookup + Verify OTP
│   │   │   │   └── trigger.ts     # Presenter triggers (SMS, voice)
│   │   │   ├── services/
│   │   │   │   ├── sync.ts        # Sync service (streams, docs, maps)
│   │   │   │   ├── messaging.ts   # SMS/WhatsApp service
│   │   │   │   ├── verify.ts      # Lookup + Verify service
│   │   │   │   └── voice.ts       # Voice/Agent Connect service
│   │   │   └── config.ts          # Env config
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   └── conversation-relay/        # ConversationRelay WebSocket server
│       ├── src/
│       │   ├── index.ts           # WebSocket server entry
│       │   ├── handler.ts         # Message/event handler
│       │   ├── llm.ts             # LLM integration (Anthropic/OpenAI)
│       │   ├── participant.ts     # Lookup participant by phone from Sync
│       │   └── config.ts          # Env config
│       ├── package.json
│       └── tsconfig.json
├── package.json                   # Workspace root
├── tsconfig.base.json
├── .gitignore
└── README.md
```
