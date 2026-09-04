# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An interactive live-presentation platform where the presentation *is* the demo. The audience registers via QR code on their phones and participates in real-time polls, text prompts, SMS, and AI voice calls — all driven from the presenter's keyboard on stage and orchestrated through Twilio APIs.

## Commands

```bash
pnpm install                # setup (Node 20+, pnpm)
pnpm dev                    # run all four packages together
pnpm dev:backend            # Fastify API on :3001
pnpm dev:presenter          # Vite dev server — 3D stage display
pnpm dev:audience           # Vite dev server — mobile audience app
pnpm dev:relay              # ConversationRelay WebSocket server on :3003
pnpm build                  # builds shared → presenter → audience → backend (in order)
pnpm typecheck              # tsc --noEmit across all packages (-r)
pnpm test                   # Vitest — packages/shared only (deck resolution, validation, sync names)
fly deploy                  # deploy backend to Fly.io (syd region)
```

No linter is configured. `pnpm typecheck` plus `pnpm test` (Vitest, in `packages/shared` only — the pure deck/sync-name functions) are the automated checks; everything else is verified manually. Since `shared` is consumed as a workspace dependency, if you change `packages/shared` you must `pnpm --filter @twilio-preso/shared build` before other packages pick up the new types (the top-level `build` does this first).

## Architecture

pnpm monorepo, five packages under `packages/`:

| Package | Stack | Role |
|---------|-------|------|
| `shared` | TypeScript | Stage definitions + types — the single source of truth |
| `presenter` | React 19 + React Three Fiber + GSAP + Zustand | 3D stage visuals on the big screen |
| `audience` | React 19 + Tailwind | Mobile web app for audience participation |
| `backend` | Fastify 5 + Twilio SDK | API, Twilio Sync setup, SMS/Voice orchestration |
| `conversation-relay` | `ws` + Anthropic Claude | AI voice agent via Twilio ConversationRelay |

### The stage model — library + deck

What stages *exist* is separate from what a given presentation *shows*.

- **`packages/shared/src/stageLibrary.ts`** — `STAGE_LIBRARY`, a `Record<string, StageTemplate>` of the 23 stages that exist as presenter components, keyed by stage id. Templates carry no index: position is a property of a deck, not of a stage. Each may declare an `interaction` (poll / text / sentiment / llm-prompt prompt shown on audience phones), a `demoTrigger` (`DemoTriggerId` — fires a real Twilio action when the presenter reaches the stage), and `dependsOn` (stage ids whose responses the trigger reads).
- **`packages/shared/src/deck.ts`** — a `Deck` is an ordered list of `DeckStage`s, each a `stageId` plus optional overrides. `resolveDeck(deck)` merges template with overrides and stamps the runtime `index`, returning the `ResolvedStage[]` that presenter, audience, and backend consume. **Override rule: `undefined` inherits from the template, explicit `null` disables** — so a presenter can suppress the mass-outbound call without deleting the slide. `DEFAULT_DECK` is every library stage in library order.
- **`packages/shared/src/validateDeck.ts`** — `validateDeck` returns `DeckWarning[]` for a reordered deck: a trigger whose `dependsOn` stage is absent or sequenced after it, an unknown stage id, an `llm-prompt` stage with no model configured. These are **warnings surfaced in the HUD, never hard errors** — nothing here blocks a presentation.

`packages/presenter/src/deck.ts` and `packages/backend/src/deck.ts` currently resolve `DEFAULT_DECK` at module level, standing in for the per-session deck that will come from the session record. Call sites already read a resolved array, so only those two files change when sessions land.

To add or change presentation content, edit `STAGE_LIBRARY` first, then add the matching presenter stage component in `packages/presenter/src/stages/StageNN*.tsx` and, if there's a new `demoTrigger`, a case in the backend trigger route.

`packages/shared/src/__tests__/stages.fixture.json` is a verbatim capture of the pre-refactor `STAGES` array. `resolveDeck(DEFAULT_DECK)` is asserted against it — do not edit the fixture to make a test pass; it is the record of what shipped.

### Twilio Sync is the state bus

There is **no custom WebSocket/state server** — Twilio Sync is the real-time backbone tying presenter, audience, and backend together. Set up in `packages/backend/src/services/sync.ts`:
- `presentation-state` document — **primary sync mechanism.** Holds `currentStageIndex`, `activeInteraction`, `totalParticipants`, `isLive`. Every client subscribes; advancing a stage updates this doc and all clients (including a second presenter laptop) follow.
- `aggregate-results` document — live poll/word-cloud tallies.
- `event-stream` — fire-and-forget events (stage-advance, interaction-prompt, audience-response, participant-joined).
- `participants` SyncMap — one entry per registered attendee, keyed by participant id, holding their `responses`.

Clients fetch a short-lived Sync access token from the backend (`GET /api/token?identity=`) then connect directly to Twilio — the backend is not in the realtime path.

### Navigation & the echo-suppression pattern

Presenter navigation lives in `packages/presenter/src/hooks/useNavigation.ts`. Arrow/space keys advance the local Zustand store (`store.ts`); a store change publishes to the Sync document. Because every client *also listens* to that document, there's a loop risk: `suppressPublish()` sets a one-shot flag so a stage change that arrived *from* Sync doesn't get re-published. When editing navigation or sync code, preserve this suppress-on-inbound pattern or you'll create infinite update loops.

The presenter notes window (opened with `n`) is a separate browser window in the same browser; it coordinates via `BroadcastChannel('presenter-sync')`, not Sync.

### Demo triggers fire real Twilio actions

When the presenter reaches a stage with a `demoTrigger` **and `isLive` is true**, `useNavigation` POSTs to `/api/trigger`. `packages/backend/src/routes/trigger.ts` switches on the trigger id and sends real SMS/voice via the Twilio services in `packages/backend/src/services/`. Notably `sms-memory` personalizes each message using the participant's earlier word-cloud answer (stage 10). `voice-mass-outbound` calls every participant, routing to the ConversationRelay WebSocket if `CONVERSATION_RELAY_URL` is set, else a static TwiML bot. **`isLive` gates all outbound Twilio traffic** — keep it off unless you actually intend to message/call real phones.

### ConversationRelay voice agent

`packages/conversation-relay` is a standalone WebSocket server that Twilio ConversationRelay connects to. On `setup` it looks up the caller by phone number in the participants map and greets them by name; `prompt` events are answered by Claude (`llm.ts`) with running conversation history. TwiML that points calls at it is served from the backend (`/api/voice/conversation-relay`).

## Config & deployment

- Backend env is validated at boot in `packages/backend/src/config.ts` (`requireEnv` throws on missing vars). See `.env.example` for the full list. `.env.regional` holds an alternate regional Twilio config.
- Backend deploys to Fly.io in `syd` (`fly.toml`, `packages/backend/Dockerfile`). Presenter runs locally on the stage machine; audience is built to static files.
- Presenter reads `VITE_BACKEND_URL` (defaults to `http://localhost:3001`).

## Visual design rules (presenter)

These are strict and have been corrected repeatedly — follow exactly:
- **Background: `#000d25`** everywhere (semi-transparent overlays: `rgba(0, 13, 37, 0.85)`). Never substitute another dark blue.
- **Main red: `#ef223a`.** Text `#ffffff`; accents `#babecc`, `#7e869c`, `#4d5777`; pill bg `#1e3a5f`.
- **Fonts: Tektur Bold for headlines/titles only. Space Grotesk for everything else** (numbers, labels, body, badges). Never use Tektur for numbers or small labels.
- Cards use `<Html>` with a `transform` prop (not 3D mesh planes): `#000d25` bg, `2px solid rgba(239,34,58,0.4)` border, 10–12px radius, red glow shadow, shimmer + gentle float animation.
