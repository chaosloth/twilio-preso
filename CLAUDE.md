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

Neither backend nor presenter has a module-level deck any more. The backend resolves `session.deck` per request (`stagesFor` in `services/sessionContext.ts`); the presenter holds `stages: ResolvedStage[]` in its Zustand store, set by the session picker from the record, and `advance`/`goTo` clamp on `stages.length`. `packages/presenter/src/deck.ts` is gone.

To add or change presentation content, edit `STAGE_LIBRARY` first, then add the matching presenter stage component in `packages/presenter/src/stages/StageNN*.tsx` and, if there's a new `demoTrigger`, a case in the backend trigger route.

`packages/shared/src/__tests__/stages.fixture.json` is a verbatim capture of the pre-refactor `STAGES` array. `resolveDeck(DEFAULT_DECK)` is asserted against it — do not edit the fixture to make a test pass; it is the record of what shipped.

### Twilio Sync is the state bus

There is **no custom WebSocket/state server** — Twilio Sync is the real-time backbone tying presenter, audience, and backend together. Set up in `packages/backend/src/services/sync.ts`:
- `presentation-state` document — **primary sync mechanism.** Holds `currentStageIndex`, `activeInteraction`, `totalParticipants`, `isLive`. Every client subscribes; advancing a stage updates this doc and all clients (including a second presenter laptop) follow.
- `aggregate-results` document — live poll/word-cloud tallies.
- `event-stream` — fire-and-forget events (stage-advance, interaction-prompt, audience-response, participant-joined).
- `participants` SyncMap — one entry per registered attendee, keyed by participant id, holding their `responses`.

Every one of these objects is per-session and name-prefixed (`s_<id>_*`, via `syncNames`); the bullets above name the *roles*, not the literal unique names. Clients fetch a short-lived Sync access token from the backend (`GET /api/token?identity=&sessionId=`, issued only to a presenter or a registered participant of that session) then connect directly to Twilio — the backend is not in the realtime path.

That token lasts **one hour**, which a rehearsal plus the talk itself outlives, so both clients renew it on the SDK's `tokenAboutToExpire` / `tokenExpired` events (`packages/{presenter,audience}/src/sync.ts`). Unrenewed, the failure is silent and looks like a bug elsewhere: the presenter still advances locally, `stateDocument.update()` throws into a `console.warn`, and every phone sits on the previous slide. The audience badge reports the client's real `connectionState` for the same reason — it used to report "Connected" whenever a client object existed — and re-inits when the connection is dead for good rather than merely flaky.

### Navigation & the echo-suppression pattern

Presenter navigation lives in `packages/presenter/src/hooks/useNavigation.ts`. Arrow/space keys advance the local Zustand store (`store.ts`); a store change publishes to the Sync document. Because every client *also listens* to that document, there's a loop risk: `suppressPublish()` sets a one-shot flag so a stage change that arrived *from* Sync doesn't get re-published. When editing navigation or sync code, preserve this suppress-on-inbound pattern or you'll create infinite update loops.

The presenter notes window (opened with `n`) is a separate browser window in the same browser; it coordinates via `` BroadcastChannel(`presenter-sync:${sessionId}`) ``, not Sync. The channel name and window name are both session-suffixed, and the session id is passed in the window URL (`/notes?sessionId=`) rather than a shared localStorage key — otherwise two presenter windows for different sessions in one browser drive each other's slides. Because the notes window is its own React root with its own store, it fetches the deck from `GET /api/sessions/:id` instead of importing it.

`NotesApp.tsx` is chrome only — header, tabs, and the BroadcastChannel link. All backend access lives in `notes/useAdminApi.ts` (participants poll, `isLive` mode, reset, manual triggers, deck commit) and each of `notes/tabs/{Notes,Participants,Controls,Deck,Allowlist}Tab.tsx` renders one slice of it; shared inline styles are in `notes/ui.tsx`. The **deck editor** edits a local draft and previews `validateDeck` warnings against it, so a half-finished reorder never reaches the running presentation; Export/import moves a deck between environments: `packages/shared/src/deckTransfer.ts` writes a versioned envelope and parses that, a bare `Deck`, or a bare stage array, copying **field by field** (a foreign file cannot introduce keys) and refusing a newer format version outright rather than importing half of it; an unknown *stage id* is only a warning. Import loads the draft, never the session. On save it broadcasts `deck-change` and the presentation window re-reads the record (`setStages` keeps the presenter on their current slide, clamping only if the deck got shorter). Per-stage "trigger on/off" writes `demoTrigger: null` — the suppression that keeps the slide but not its outbound call. Deck stages are keyed by `stageId`+position, never `stageId` alone: a deck may legitimately contain the same stage twice. The **allowlist editor** is the same `presenter-allowlist` map as `/api/presenters`; it hides self-removal, but the backend refusing it is what actually prevents a lockout.

### Presenter boot gate

`App.tsx` is a three-state gate in front of the canvas: no valid token → `pages/Login.tsx` (phone → OTP), token but no session → `pages/SessionPicker.tsx`, session selected → the 3D presentation. A stored token (`wonder-presenter-token`) is only trusted once `GET /api/auth/me` confirms it, so a de-listed presenter is stopped at boot rather than at token expiry. `auth.ts` owns the token and `presenterFetch`; `sessions.ts` owns the session API and `stagesFor`.

Picking a `draft` session flips it to `live` first — phones cannot register against a draft — but the `isLive` outbound-Twilio gate stays **off** until it is armed in the HUD. That split is the whole point of rehearsal mode: `status: 'live'` means joinable, `isLive` means real SMS and calls. "End & export" downloads the JSON and CSV from the same response that destroys the data, since teardown is irreversible.

`Stage01Opening` encodes `${AUDIENCE_URL}/j/${joinCode}` in the QR and shows the code beneath it in Space Grotesk (it is a value, not a headline).

### Demo triggers fire real Twilio actions

When the presenter reaches a stage with a `demoTrigger` **and `isLive` is true**, `useNavigation` POSTs to `/api/trigger`. `packages/backend/src/routes/trigger.ts` switches on the trigger id and sends real SMS/voice via the Twilio services in `packages/backend/src/services/`. Notably `sms-memory` personalizes each message using the participant's earlier word-cloud answer (stage 10). The two voice finales are **separate trigger ids, not one branch with a flag**: `voice-mass-outbound` always calls every participant into the scripted `<Say>` TwiML bot, and `voice-mass-relay` always calls them into ConversationRelay — it **409s when `CONVERSATION_RELAY_URL` is unset** rather than quietly degrading to the bot, because a finale that silently becomes a recording looks like the agent failed. `voice-agent-connect` is the same call to one volunteer, fired from their row in the HUD's Participants tab.

The inbound direction has its own two stages rather than a trigger, since the audience initiates it: `call-in` shows the session's claimed number in large Space Grotesk, `whatsapp-invite` shows a `wa.me` QR, and both carry a `call-cta`/`whatsapp-cta` interaction that puts a "Call now" / "Open WhatsApp" `<a href>` on every phone. Those two interaction types publish **no response** — what they produce is a real call or message arriving over Twilio. They need the number on the phone, which is why `PublicSession` exposes `phoneNumber` and `packages/shared/src/phone.ts` owns the one `tel:` / `wa.me` builder both apps use. Each `sms-*` trigger has a `whatsapp-*` sibling sharing its branch (`kind` strips the prefix), so the copy cannot drift. Twilio's automatic channel fallback exists only in the Bulk Messaging API, not on the classic Messages API this app needs for its per-session `from`, so `sendOnChannel` falls back **per recipient**: try WhatsApp, and on any failure — a closed 24-hour window (63016), an unregistered number, an unset `TWILIO_WHATSAPP_FROM` — send the same body as SMS. One attendee outside the window must not drop the room to SMS.

**`isLive` gates all outbound Twilio traffic** — keep it off unless you actually intend to message/call real phones. The gate is enforced **server-side**, not just in `useNavigation`: `/api/trigger` returns 409 when the session is not armed, and the registration welcome SMS is behind the same check. Rehearsal has to hold against every caller — a HUD manual-trigger button, a second laptop, a stale tab, and (for the welcome SMS) an audience phone that needs no presenter action at all.

### ConversationRelay voice agent

`packages/conversation-relay` is a standalone WebSocket server that Twilio ConversationRelay connects to. On `setup` it resolves the session, looks the caller up in that session's participants map, and greets them by name; `prompt` events are answered by Claude (`llm.ts`) with running conversation history. TwiML that points calls at it is served from the backend (`/api/voice/conversation-relay`).

Setup assembles a `CallerContext` (`src/llm.ts`) from three distinct sources: this session's Sync answers, the profile's declared **traits** (name, company, role) and its recent **observations** — fetched directly via `GET /Profiles/{id}` and `/Observations`, because unlike `Recall` they are readable the moment they are written, which matters when the call lands seconds after the poll. `Recall` sits on top, since it can surface something older. The greeting is generated from that context, but `staticGreeting` is always computed first and returned whenever the model gives nothing usable — a dead model on the opening turn is silence on a ringing phone.

**Calling in works, not just being called.** `claimPhoneNumber` points the claimed number's inbound `voiceUrl` at `/api/voice/conversation-relay?sessionId=` (best-effort — a number that cannot be reconfigured must not fail session creation), and a caller with no participant record is resolved by `lookupProfileByPhone`, since the phone identifier is what Identity Resolution merges on. An inbound caller gets twelve turns, the outbound finale three.

Session resolution (`src/session.ts`) has a declared path and an inferred one. The TwiML carries `<Parameter name="sessionId">` when the backend knows it — `voice-mass-outbound` appends `?sessionId=` to the webhook URL, and the signature covers the query string, so this needs no change to validation. Failing that, it looks the session's claimed pool number up in `phone-pool-claims`. **Which end of the call that number is depends on direction:** an outbound call is placed *from* the pool number to the attendee, an inbound call is the reverse, and getting it backwards silently looks up the wrong party. The setup message's real fields are `from` / `to` / `direction` / `customParameters` — there is no `callerNumber`, which is why the pre-refactor lookup never matched and every caller got the generic greeting.

### Conversation Memory holds who the person is

Sync holds what *this* session's phones have said; **Twilio Conversation Memory** holds the durable Customer Profile that outlives the event. `packages/backend/src/services/memory.ts` is a small basic-auth fetch client over `https://memory.twilio.com/v1/Stores/{TWILIO_MEMORY_STORE_ID}` — there is no Node SDK surface for these endpoints yet.

`TWILIO_MEMORY_STORE_ID` is **optional** (`config.twilio.memoryStoreId`, deliberately not `requireEnv`): unset, every function is a no-op and every call site falls back to the Sync `responses` path. The whole feature is best-effort — registration `void`s `upsertProfile` and never awaits it, so a memory outage cannot fail a join, and `POST /api/response` mirrors the answer into the profile the same way.

Three API shapes here are easy to get wrong and each fails only in the production log. The identifier type is **`phone`** (the store's rules are `chat`/`email`/`phone`/`pushUserID`/`whatsapp` — `phone_number` is a 400). Traits are **grouped and declared**: the payload is `{traits: {Contact: {firstName, lastName, phone}}}`, and an undeclared trait key is rejected with a bare 400, which is why only the default `Contact` group is used and the demo needs no Console setup. `Lookup` returns `{profiles: [id, ...]}` — ids, not objects — and `Create` answers `{id, message}`, not the profile body.

Traits are **read from the store's own schema**, not assumed. `traitPayload` filters the payload against `GET /v1/ControlPlane/Stores/{id}/TraitGroups?includeTraits=true` (read once, cached, cleared by `refreshTraitSchema`) because one undeclared key rejects the whole write — dropping the company trait is survivable, losing the name with it is not. `Contact` holds firstName/lastName/phone; the `live-presentation` group holds `company`/`role` plus the mandatory-poll answers `brandName`/`theme`/`preferredOTPChannel`, which no store ships with, so `probeMemoryTraits` reports what is missing in the HUD and `POST /api/memory/traits` (`ensureTraitGroups`) creates it: POST for a missing group, PATCH to add absent traits (both 202, both merge). Never automatic — it edits the account's schema, which outlives the event. There is no REST delete for a single trait; that is Console-only.

The three **mandatory polls** (`brand-poll`, `theme-poll`, `otp-poll` — first in the deck, before any other interaction, because the rest of the talk is built on their answers) are the exception to "an answer is an observation": each option set is fixed, so the answer is a stable fact worth a trait. `RESPONSE_TRAITS` maps stage id → trait name and `writeResponseTrait` PATCHes it from `POST /api/response`, filtered against the same schema read — the trait must be declared before anything is written into it, so an unpressed "Declare missing traits" costs the traits silently. The relay reads them back from `profile.traits['live-presentation']` as `CallerContext.choices`, which is what makes a returning caller known by choices they made at a previous event.

Everything the audience *says* is still an **observation** as well as a trait where one exists: a word-cloud answer is not a stable fact with a schema, and `Recall` is a semantic search over observations, so observations are the only shape the memory SMS and the voice agent can read back. `responseObservation` phrases each answer with its stage's own prompt ("Asked …, X answered …"), which recalls far better than a bare fragment; company and role become one intro sentence for the same reason.

Registration does **Lookup by phone before Create**, then posts the phone as an *identifier* (`phone_number`): a trait is not indexed for lookup, and the identifier is what Identity Resolution merges on, which is the only thing that makes a returning attendee the same person rather than a new profile. Patch merges, so nothing a previous event learned is cleared. The profile id is written back onto the participant as `memoryProfileId`.

Two read paths use `Recall`, both with a fallback: the `sms-memory` trigger prefers a recalled observation (phrased as its own line, since it is a sentence and not a quotable phrase) over `responseFor(p, 'customers-are')`, and the voice agent recalls **once at setup** — a memory round-trip between every question and answer is dead air on a phone call. `packages/conversation-relay/src/memory.ts` is a second, read-only client on purpose: the relay is its own process with its own env and no HTTP route into the backend.

### Control plane, sessions, and auth

Multi-tenancy is landing incrementally against `docs/superpowers/specs/2026-08-05-multi-tenant-presentations-design.md`. Three **unprefixed** control-plane SyncMaps sit alongside a **per-session, prefixed** data plane:

- `presenter-allowlist` — keyed by E.164 phone. The only thing that decides who may present. `PRESENTER_BOOTSTRAP_PHONES` is re-seeded at every boot, so an emptied allowlist can never become a lockout; `DELETE /api/presenters/:phone` refuses to remove your own entry for the same reason.
- `sessions` — keyed by **join code**, so an audience join is one map read. Holds a `SessionRecord` whose `deck` is a self-contained snapshot, not a reference.
- `phone-pool-claims` — keyed by phone number. One `TWILIO_PHONE_POOL` number per concurrent session; claimed at creation, released at end. The claim doubles as the reverse lookup ConversationRelay needs, since it only knows the number that was called.

`packages/backend/src/services/sessions.ts` owns all of it. Two invariants worth preserving: **session creation writes the `sessions` entry last** (it is the only thing an audience can reach, so a partial failure must leave an unreachable session, not a joinable one with no Sync objects), and **`endSession` marks the record `ended` before destroying anything** — the record itself is kept so a re-entered code says "this has finished" rather than "unknown code".

Presenter auth is a 12-hour HS256 JWT (`PRESENTER_JWT_SECRET`, required at boot). `requirePresenter` in `services/auth.ts` checks the signature **and** that `sub` is still in the allowlist, so removing someone revokes access immediately rather than at token expiry — hence bad signature → 401, de-listed presenter → 403. `POST /api/auth/start` returns `{ sent: true }` whether or not the number is allowlisted; anything else turns it into an oracle for which colleagues can present.

Route auth is the explicit matrix in the spec, and the boundary runs in both directions — the audience has no credential, so `register`/`response`/`ai-prompt`/`token` and `GET /api/session/:code` must stay public. Everything that exposes attendee phone numbers, toggles `isLive`, or destroys data is presenter-only. TwiML webhooks can't carry a JWT, so `/api/voice/*` validates `X-Twilio-Signature` (`services/twilioSignature.ts`) — this needs `PUBLIC_BASE_URL` to match the URL Twilio signed, since behind Fly's proxy the request reports `http`.

**Everything in the data plane is session-scoped.** Every function in `services/sync.ts` takes `sessionId` as its first argument and derives its object names from `syncNames(sessionId)` — there are no unprefixed names or raw `syncService` calls left outside that file, and no `initSync()`: objects are created per session by `initSessionSync` and deleted by `teardownSessionSync`. The old account-wide `presentation-state` / `aggregate-results` / `participants` / `event-stream` objects still exist in the Sync service but nothing reads or writes them — they are dead and safe to delete.

`requireLiveSession` (`services/sessionContext.ts`) is the preHandler for every session-scoped route: it resolves `sessionId` from the body or query, loads the record, attaches it as `request.session`, and **rejects anything that is not `status: 'live'` with a 409**. That does double duty — one event's phones can't answer another's prompts, and responses can't trickle in against a session whose Sync objects are already gone. Rehearsal is `status: 'live'` with the `isLive` flag *off*, so `draft` being rejected is intended. `GET /api/token` is the one exception: a presenter needs a token while still in `draft`, so it uses `attachPresenter` (soft) and checks session membership instead of liveness.

Outbound traffic is sent **from the session's own claimed pool number**, not `TWILIO_PHONE_NUMBER` or the Messaging Service sender — `sendSms*` and `initiateAgentCall` all take `from`. `from` and `messagingServiceSid` are mutually exclusive, so this trades the service's sticky sender for per-session routing; the voice agent identifies a session by the number that was called, so that trade is required, not preference.

Read-modify-write against Sync is **conditional** (`ifMatch: revision`, retried on 412) in `updatePresentationState`, `updateParticipant`, and `recordParticipantResponse`. A plain fetch-then-update loses the write that lands second, and the field that gets lost is `isLive`: a phone registering while the presenter arms the session re-writes `totalParticipants` from a doc fetched before the arm and silently disarms it — the two-session smoke run hit exactly that. `isRevisionMismatch` in `services/syncErrors.ts` matches the 412.

Sync reports "already exists" and "not found" with **different codes for objects vs map items** (and a plain `20404` for a REST delete of a missing item). `services/syncErrors.ts` centralizes those families — matching a single code silently turned a re-added presenter and a lost race for a pool number into 500s.

Join codes (`packages/shared/src/joinCode.ts`) are Crockford base32: I/L/O/U are never emitted, and `normalizeJoinCode` folds them onto the characters they resemble on input. **Always normalize before a lookup** — the map is keyed by canonical codes only. The audience never normalizes locally — `resolveJoinCode` in `packages/audience/src/session.ts` posts whatever was typed to `GET /api/session/:code` and lets the backend fold it, so there is one implementation rather than two that can drift.

### Audience join flow

There is no router: `packages/audience/src/session.ts` parses `/j/:code` off `location.pathname` directly (`joinCodeFromPath`), and `pages/Join.tsx` is the gate in front of everything else — it resolves the code, shows "this has finished" for `ended`, and holds on "not started yet" for `draft`, re-checking every 5s so a phone flips to the registration form by itself when the presenter goes live. Bare `/` shows code entry plus a rejoin list.

Saved state is namespaced: **`wonder-session:{sessionId}`**, one entry per event, holding `{sessionId, joinCode, title, participantId, name}`. A single shared key would let a phone that attended two events resume the wrong one and publish responses under another session's participant id. `sync.ts` holds the connected `sessionId` in a module variable and derives every object name from `syncNames(sessionId)` — there are no unprefixed literals left — and `publishResponse`/`submitAiPrompt`/`POST /api/register` all carry `sessionId`.

Because the deep link is a real path, static hosting needs a fallback: `packages/audience/vercel.json` rewrites `/j/:code` to `/index.html`.

## Config & deployment

- Backend env is validated at boot in `packages/backend/src/config.ts` (`requireEnv` throws on missing vars). See `.env.example` for the full list. `.env.regional` holds an alternate regional Twilio config.
- **Environments are whole Twilio accounts, not flags.** Each one owns its own Sync/Verify/Messaging services, API key, number pool, memory store and `PRESENTER_JWT_SECRET` — a token or a Sync object from one is meaningless in another, which is the point. `horizon` is the second: `.env.horizon` + `fly.horizon.toml` (`fly deploy -c fly.horizon.toml`, app `twilio-horizon-preso-backend`), audience at `audience.twilio.solutions`, presenter at `presenter.twilio.solutions`. Adding another is: create the four Twilio resources, write `.env.<name>`, copy `fly.toml` with a new `app`, `fly secrets import`, then point that environment's two Vercel projects at the new backend.
- `PRESENTER_JWT_SECRET` is required — the backend refuses to boot without it. Set it on Fly with `fly secrets set` before the next deploy.
- Backend deploys to Fly.io in `syd` (`fly.toml`, `packages/backend/Dockerfile`). Presenter runs locally on the stage machine; audience is built to static files.
- `PUBLIC_BASE_URL` is the **single** server-side origin: every URL Twilio fetches or signs is built from it (`config.publicBaseUrl`) — signature validation, the inbound `voiceUrl` on a claimed number, and the mass-call TwiML. There is deliberately no second variable for this any more; a stale `BACKEND_URL` alongside it moved the signed origin and only failed once real calls went out. Its localhost default is for a backend nothing external calls, so set it to the tunnel origin whenever webhooks are involved.
- `VITE_BACKEND_URL` is the unrelated *client* side of the same question — inlined into the presenter and audience bundles at build time, so it must exist for the Vercel **build** and a change needs a redeploy. Presenter defaults to `http://localhost:3001` (it sits beside a local backend); audience defaults to `''`, a same-origin `/api` path, which only works where something proxies `/api` — on Vercel it does not, so both projects set it explicitly. The presenter also needs `VITE_AUDIENCE_URL`, or the QR encodes a localhost join link.

## Visual design rules (presenter)

These are strict and have been corrected repeatedly — follow exactly:
- **Background: `#000d25`** everywhere (semi-transparent overlays: `rgba(0, 13, 37, 0.85)`). Never substitute another dark blue.
- **Main red: `#ef223a`.** Text `#ffffff`; accents `#babecc`, `#7e869c`, `#4d5777`; pill bg `#1e3a5f`.
- **Fonts: Tektur Bold for headlines/titles only. Space Grotesk for everything else** (numbers, labels, body, badges). Never use Tektur for numbers or small labels.
- Cards use `<Html>` with a `transform` prop (not 3D mesh planes): `#000d25` bg, `2px solid rgba(239,34,58,0.4)` border, 10–12px radius, red glow shadow, shimmer + gentle float animation.
