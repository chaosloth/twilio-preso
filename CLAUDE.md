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

The backend no longer has a module-level deck: it resolves `session.deck` per request (`stagesFor` in `services/sessionContext.ts`). `packages/presenter/src/deck.ts` still resolves `DEFAULT_DECK` at module level, standing in for the deck the session picker will supply; call sites already read a resolved array, so only that file changes.

To add or change presentation content, edit `STAGE_LIBRARY` first, then add the matching presenter stage component in `packages/presenter/src/stages/StageNN*.tsx` and, if there's a new `demoTrigger`, a case in the backend trigger route.

`packages/shared/src/__tests__/stages.fixture.json` is a verbatim capture of the pre-refactor `STAGES` array. `resolveDeck(DEFAULT_DECK)` is asserted against it — do not edit the fixture to make a test pass; it is the record of what shipped.

### Twilio Sync is the state bus

There is **no custom WebSocket/state server** — Twilio Sync is the real-time backbone tying presenter, audience, and backend together. Set up in `packages/backend/src/services/sync.ts`:
- `presentation-state` document — **primary sync mechanism.** Holds `currentStageIndex`, `activeInteraction`, `totalParticipants`, `isLive`. Every client subscribes; advancing a stage updates this doc and all clients (including a second presenter laptop) follow.
- `aggregate-results` document — live poll/word-cloud tallies.
- `event-stream` — fire-and-forget events (stage-advance, interaction-prompt, audience-response, participant-joined).
- `participants` SyncMap — one entry per registered attendee, keyed by participant id, holding their `responses`.

Every one of these objects is per-session and name-prefixed (`s_<id>_*`, via `syncNames`); the bullets above name the *roles*, not the literal unique names. Clients fetch a short-lived Sync access token from the backend (`GET /api/token?identity=&sessionId=`, issued only to a presenter or a registered participant of that session) then connect directly to Twilio — the backend is not in the realtime path.

### Navigation & the echo-suppression pattern

Presenter navigation lives in `packages/presenter/src/hooks/useNavigation.ts`. Arrow/space keys advance the local Zustand store (`store.ts`); a store change publishes to the Sync document. Because every client *also listens* to that document, there's a loop risk: `suppressPublish()` sets a one-shot flag so a stage change that arrived *from* Sync doesn't get re-published. When editing navigation or sync code, preserve this suppress-on-inbound pattern or you'll create infinite update loops.

The presenter notes window (opened with `n`) is a separate browser window in the same browser; it coordinates via `BroadcastChannel('presenter-sync')`, not Sync.

### Demo triggers fire real Twilio actions

When the presenter reaches a stage with a `demoTrigger` **and `isLive` is true**, `useNavigation` POSTs to `/api/trigger`. `packages/backend/src/routes/trigger.ts` switches on the trigger id and sends real SMS/voice via the Twilio services in `packages/backend/src/services/`. Notably `sms-memory` personalizes each message using the participant's earlier word-cloud answer (stage 10). `voice-mass-outbound` calls every participant, routing to the ConversationRelay WebSocket if `CONVERSATION_RELAY_URL` is set, else a static TwiML bot. **`isLive` gates all outbound Twilio traffic** — keep it off unless you actually intend to message/call real phones.

### ConversationRelay voice agent

`packages/conversation-relay` is a standalone WebSocket server that Twilio ConversationRelay connects to. On `setup` it looks up the caller by phone number in the participants map and greets them by name; `prompt` events are answered by Claude (`llm.ts`) with running conversation history. TwiML that points calls at it is served from the backend (`/api/voice/conversation-relay`).

### Control plane, sessions, and auth

Multi-tenancy is landing incrementally against `docs/superpowers/specs/2026-08-05-multi-tenant-presentations-design.md`. Three **unprefixed** control-plane SyncMaps sit alongside a **per-session, prefixed** data plane:

- `presenter-allowlist` — keyed by E.164 phone. The only thing that decides who may present. `PRESENTER_BOOTSTRAP_PHONES` is re-seeded at every boot, so an emptied allowlist can never become a lockout; `DELETE /api/presenters/:phone` refuses to remove your own entry for the same reason.
- `sessions` — keyed by **join code**, so an audience join is one map read. Holds a `SessionRecord` whose `deck` is a self-contained snapshot, not a reference.
- `phone-pool-claims` — keyed by phone number. One `TWILIO_PHONE_POOL` number per concurrent session; claimed at creation, released at end. The claim doubles as the reverse lookup ConversationRelay needs, since it only knows the number that was called.

`packages/backend/src/services/sessions.ts` owns all of it. Two invariants worth preserving: **session creation writes the `sessions` entry last** (it is the only thing an audience can reach, so a partial failure must leave an unreachable session, not a joinable one with no Sync objects), and **`endSession` marks the record `ended` before destroying anything** — the record itself is kept so a re-entered code says "this has finished" rather than "unknown code".

Presenter auth is a 12-hour HS256 JWT (`PRESENTER_JWT_SECRET`, required at boot). `requirePresenter` in `services/auth.ts` checks the signature **and** that `sub` is still in the allowlist, so removing someone revokes access immediately rather than at token expiry — hence bad signature → 401, de-listed presenter → 403. `POST /api/auth/start` returns `{ sent: true }` whether or not the number is allowlisted; anything else turns it into an oracle for which colleagues can present.

Route auth is the explicit matrix in the spec, and the boundary runs in both directions — the audience has no credential, so `register`/`response`/`ai-prompt`/`token` and `GET /api/session/:code` must stay public. Everything that exposes attendee phone numbers, toggles `isLive`, or destroys data is presenter-only. TwiML webhooks can't carry a JWT, so `/api/voice/*` validates `X-Twilio-Signature` (`services/twilioSignature.ts`) — this needs `PUBLIC_BASE_URL` to match the URL Twilio signed, since behind Fly's proxy the request reports `http`.

**Everything in the data plane is session-scoped.** Every function in `services/sync.ts` takes `sessionId` as its first argument and derives its object names from `syncNames(sessionId)` — there are no unprefixed names or raw `syncService` calls left outside that file, and no `initSync()`: objects are created per session by `initSessionSync` and deleted by `teardownSessionSync`. The old account-wide `presentation-state` / `aggregate-results` / `participants` / `event-stream` objects still exist in the Sync service but nothing writes them (`packages/conversation-relay` still reads `participants` until session resolution lands).

`requireLiveSession` (`services/sessionContext.ts`) is the preHandler for every session-scoped route: it resolves `sessionId` from the body or query, loads the record, attaches it as `request.session`, and **rejects anything that is not `status: 'live'` with a 409**. That does double duty — one event's phones can't answer another's prompts, and responses can't trickle in against a session whose Sync objects are already gone. Rehearsal is `status: 'live'` with the `isLive` flag *off*, so `draft` being rejected is intended. `GET /api/token` is the one exception: a presenter needs a token while still in `draft`, so it uses `attachPresenter` (soft) and checks session membership instead of liveness.

Outbound traffic is sent **from the session's own claimed pool number**, not `TWILIO_PHONE_NUMBER` or the Messaging Service sender — `sendSms*` and `initiateAgentCall` all take `from`. `from` and `messagingServiceSid` are mutually exclusive, so this trades the service's sticky sender for per-session routing; the voice agent identifies a session by the number that was called, so that trade is required, not preference.

Sync reports "already exists" and "not found" with **different codes for objects vs map items** (and a plain `20404` for a REST delete of a missing item). `services/syncErrors.ts` centralizes those families — matching a single code silently turned a re-added presenter and a lost race for a pool number into 500s.

Join codes (`packages/shared/src/joinCode.ts`) are Crockford base32: I/L/O/U are never emitted, and `normalizeJoinCode` folds them onto the characters they resemble on input. **Always normalize before a lookup** — the map is keyed by canonical codes only. The audience never normalizes locally — `resolveJoinCode` in `packages/audience/src/session.ts` posts whatever was typed to `GET /api/session/:code` and lets the backend fold it, so there is one implementation rather than two that can drift.

### Audience join flow

There is no router: `packages/audience/src/session.ts` parses `/j/:code` off `location.pathname` directly (`joinCodeFromPath`), and `pages/Join.tsx` is the gate in front of everything else — it resolves the code, shows "this has finished" for `ended`, and holds on "not started yet" for `draft`, re-checking every 5s so a phone flips to the registration form by itself when the presenter goes live. Bare `/` shows code entry plus a rejoin list.

Saved state is namespaced: **`wonder-session:{sessionId}`**, one entry per event, holding `{sessionId, joinCode, title, participantId, name}`. A single shared key would let a phone that attended two events resume the wrong one and publish responses under another session's participant id. `sync.ts` holds the connected `sessionId` in a module variable and derives every object name from `syncNames(sessionId)` — there are no unprefixed literals left — and `publishResponse`/`submitAiPrompt`/`POST /api/register` all carry `sessionId`.

Because the deep link is a real path, static hosting needs a fallback: `packages/audience/vercel.json` rewrites `/j/:code` to `/index.html`.

## Config & deployment

- Backend env is validated at boot in `packages/backend/src/config.ts` (`requireEnv` throws on missing vars). See `.env.example` for the full list. `.env.regional` holds an alternate regional Twilio config.
- `PRESENTER_JWT_SECRET` is required — the backend refuses to boot without it. Set it on Fly with `fly secrets set` before the next deploy.
- Backend deploys to Fly.io in `syd` (`fly.toml`, `packages/backend/Dockerfile`). Presenter runs locally on the stage machine; audience is built to static files.
- Presenter reads `VITE_BACKEND_URL` (defaults to `http://localhost:3001`).

## Visual design rules (presenter)

These are strict and have been corrected repeatedly — follow exactly:
- **Background: `#000d25`** everywhere (semi-transparent overlays: `rgba(0, 13, 37, 0.85)`). Never substitute another dark blue.
- **Main red: `#ef223a`.** Text `#ffffff`; accents `#babecc`, `#7e869c`, `#4d5777`; pill bg `#1e3a5f`.
- **Fonts: Tektur Bold for headlines/titles only. Space Grotesk for everything else** (numbers, labels, body, badges). Never use Tektur for numbers or small labels.
- Cards use `<Html>` with a `transform` prop (not 3D mesh planes): `#000d25` bg, `2px solid rgba(239,34,58,0.4)` border, 10–12px radius, red glow shadow, shimmer + gentle float animation.
