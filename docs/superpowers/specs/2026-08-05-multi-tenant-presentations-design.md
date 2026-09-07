# Multi-Tenant Presentations — Design

**Date:** 2026-08-05
**Status:** Approved, ready for implementation planning

## Problem

The platform assumes exactly one presentation exists. Two presenters cannot run events at the same time, and every presentation must show the same 23 slides in the same order.

Three concrete single-tenant assumptions cause this:

1. **Sync object names are module constants** — `presentation-state`, `aggregate-results`, `event-stream`, `participants` (`packages/backend/src/services/sync.ts:8-11`). One global set of state, shared by every client.
2. **`STAGES` is a hardcoded module array** — `packages/shared/src/stages.ts`. Presenter, audience, and backend all import it directly and key off array position.
3. **No session concept in the backend** — `/api/register`, `/api/response`, `/api/trigger`, `/api/admin/*` all operate on the one global set.

The most dangerous consequence: `isLive` is global. A presenter rehearsing while another runs live shares one flag that governs whether real SMS and voice calls go to real phones.

Two secondary problems block per-presentation decks specifically:

- **Responses are keyed by `stageIndex`.** `sms-memory` finds the word-cloud answer with `r.stageIndex === 10` (`routes/trigger.ts:38`). Reorder or omit a stage and index 10 is a different slide, or nothing.
- **`InteractionConfig.stageIndex` duplicates array position.** It is hand-written into all six interaction literals in `stages.ts` — a second source of truth that reordering silently falsifies.

## Goals

- Multiple presenters run isolated presentations simultaneously on one Twilio account.
- Each audience member's QR code anchors them to one specific presentation.
- Each presentation has its own slide set and slide order, composed from the existing stage library.
- Presenter access is gated by Twilio Verify against an allowlist editable in the HUD.

## Non-Goals

- No-code authoring of genuinely new slides. A deck composes, reorders, omits, and reconfigures stages that already exist as components.
- User accounts, signup, roles, or billing. All allowlisted presenters have identical capability.
- A reusable named-deck registry. Sessions clone `DEFAULT_DECK` or a prior session's deck.
- Migration of previously exported participant data.
- UI tests or a Twilio mock layer.

## Decisions

Recorded because each had a viable alternative that was considered and rejected.

| Decision | Alternative rejected | Reason |
|---|---|---|
| Namespaced object names in one Sync service | Sync service per session; per-identity ACLs | Chosen by project owner. Fewer Twilio resources, no ACL bookkeeping. |
| Opaque session uuid in object names; short code for humans | Short code everywhere | Under namespacing, obscurity is the isolation boundary. A 6-char code is guessable; a uuid is not. |
| Deck copied into the session record | Deck referenced by id | Concurrent presenters cannot perturb each other; editing a deck cannot retroactively change a past event. |
| Responses keyed by stage id | Keep `stageIndex` | Index-keyed responses break under any reordering. |
| No deck registry | `decks` SyncMap | One more concept and a staleness question, for a team running a handful of events. |
| 12-hour presenter JWT, no refresh | Refresh tokens | Covers an event day; a mid-presentation re-auth is an ugly on-stage failure. |

### Residual risk (accepted)

Under namespacing, the Sync access token's `SyncGrant` is **service-wide** (`sync.ts:120`). A participant who learns another session's uuid can subscribe to that session's objects. Uuids are not discoverable without the join code, and the public code lookup is rate-limited, so the practical attack requires guessing a 6-character code against a throttled endpoint. This is acceptable for internal, trusted use. Tightening to per-identity ACLs later is a change to `generateSyncToken` and the token route, not an audit of every call site.

Presenter JWTs are bearer-only. Anyone who copies one off a stage machine can drive any session until expiry.

## Architecture

The existing Sync service splits into a **control plane** (stable, unprefixed objects) and a **data plane** (per-session, prefixed objects).

### Control plane

Three SyncMaps in the current service:

| Object | Key | Value |
|---|---|---|
| `presenter-allowlist` | E.164 phone | `{ name, addedBy, addedAt }` |
| `sessions` | join code | `SessionRecord` |
| `phone-pool-claims` | phone number | `{ sessionId, claimedAt }` |

```ts
interface SessionRecord {
  id: string;          // opaque uuid — used in Sync object names and tokens
  joinCode: string;    // 6-char Crockford base32, ambiguous chars excluded
  title: string;
  ownerPhone: string;  // allowlist entry that created it
  deck: Deck;          // self-contained snapshot, not a reference
  phoneNumber: string; // claimed from the pool
  status: 'draft' | 'live' | 'ended';
  createdAt: number;
  endedAt?: number;
}
```

### Data plane

Four objects per session. The naming convention lives in exactly one place:

```ts
// packages/shared/src/syncNames.ts
export const syncNames = (sessionId: string) => ({
  state:        `s_${sessionId}_presentation-state`,
  aggregate:    `s_${sessionId}_aggregate-results`,
  events:       `s_${sessionId}_event-stream`,
  participants: `s_${sessionId}_participants`,
});
```

`isLive` already lives on the state document; prefixing makes it per-session, which resolves the rehearse-vs-live hazard.

### Session lifecycle

`draft` → `live` → `ended`. Ending a session exports a JSON + CSV snapshot, **deletes its four Sync objects**, and releases its phone number. Without deletion, one Sync service accumulates four objects per event indefinitely and eventually hits service limits.

## Presenter auth

```
POST /api/auth/start   { phone }        → { sent: true }
POST /api/auth/verify  { phone, code }  → { token, name }
GET  /api/auth/me                       → { phone, name }
```

`/api/auth/start` checks the allowlist, then calls Twilio Verify (`verifications.create({ to, channel: 'sms' })`). **If the phone is not allowlisted it returns the same `{ sent: true }` and sends nothing** — otherwise the endpoint enumerates which colleagues' numbers are registered. The caller sees "code never arrived."

`/api/auth/verify` calls `verificationChecks.create`. On `approved`, signs an HS256 JWT: `{ sub: phone, name, iat, exp }`, 12-hour expiry, secret from a new required env var `PRESENTER_JWT_SECRET` validated at boot by the existing `requireEnv` in `config.ts`.

`requirePresenter` is a Fastify `preHandler` decorating `request.presenter`. It validates the bearer JWT (signature, expiry) and confirms `sub` is still present in `presenter-allowlist` — so removing someone from the allowlist revokes their access immediately rather than at token expiry.

Every route falls into exactly one of two buckets. The audience is unauthenticated by necessity — attendees have no credential — so the boundary must be explicit in both directions:

| Route | Auth | Note |
|---|---|---|
| `POST /api/trigger` | **Presenter JWT** | Currently unauthenticated and fires real voice calls to every registered phone (`trigger.ts:16`) |
| `GET/POST /api/admin/mode` | **Presenter JWT** | Toggles `isLive` — gates all outbound Twilio traffic |
| `GET /api/admin/participants` | **Presenter JWT** | Exposes names and phone numbers |
| `DELETE /api/admin/participants/:id` | **Presenter JWT** | |
| `POST /api/admin/reset` | **Presenter JWT** | Destructive |
| `POST /api/admin/gc` | **Presenter JWT** | Destructive |
| `GET/POST/DELETE /api/presenters` | **Presenter JWT** | Allowlist editing |
| `* /api/sessions*` | **Presenter JWT** | Create, edit deck, end, export |
| `POST /api/auth/start` \| `verify` | Public | Rate-limited; allowlist-gated internally |
| `GET /api/auth/me` | **Presenter JWT** | Token validation probe |
| `GET /api/session/:code` | Public | Rate-limited. Returns only `{ sessionId, title, status }` |
| `POST /api/register` | Public | Audience join |
| `POST /api/response` | Public | Audience answer |
| `POST /api/ai-prompt` | Public | Audience prompt |
| `GET /api/token` | Public | Mints a Sync token; validates the identity belongs to the session |
| `POST /api/voice/*` | Twilio | TwiML webhooks — see below |

Any allowlisted presenter may drive any session; there is no per-session ownership check. This is deliberate — the co-presenting case (two people sharing one deck from two laptops) is a primary use, and `ownerPhone` on the session record is provenance, not permission.

**Twilio webhooks** (`/api/voice/conversation-relay`, `/api/voice/demo-bot`) cannot carry a presenter JWT, since Twilio calls them. They should be validated with Twilio's request signature (`twilio.validateRequest` against the `X-Twilio-Signature` header) rather than left open — they are currently unauthenticated, and an open TwiML endpoint is an abuse vector. This is a small addition and I have included it in the implementation order.

**Bootstrap.** An empty allowlist is an unrecoverable lockout. `config.ts` reads `PRESENTER_BOOTSTRAP_PHONES` (comma-separated) and seeds missing entries at boot. Idempotent, so it self-heals after an accidental deletion.

**Allowlist CRUD** — `GET/POST/DELETE /api/presenters`, presenter-authed, with one rule: **you cannot delete your own entry.** Bootstrap plus this rule means the allowlist cannot be emptied into a lockout mid-demo.

## Deck model

`STAGES` currently conflates *what stages exist* with *what this presentation shows*. Splitting them is the core change.

### What exists

`DemoTriggerId` is the trigger union currently inlined on `StageDefinition.demoTrigger` (`stages.ts:10`), extracted to a named type so deck overrides and the backend switch share one definition:

```ts
export type DemoTriggerId =
  | 'sms-patience' | 'sms-orchestrator' | 'sms-memory'
  | 'intelligence-analysis' | 'voice-agent-connect'
  | 'voice-mass-outbound' | 'sms-closing';
```

```ts
// packages/shared/src/stageLibrary.ts
export interface StageTemplate {
  id: string;                  // 'customers-are' — also the presenter component key
  title: string;
  act: 1 | 2 | 3 | 4;
  notes: string;
  interaction: InteractionConfig | null;
  demoTrigger?: DemoTriggerId;
  /** Stage ids whose responses this stage's trigger reads. Drives validation. */
  dependsOn?: string[];
}

export const STAGE_LIBRARY: Record<string, StageTemplate>;
```

`STAGES` is deleted rather than kept as a deprecated alias, so `pnpm typecheck` locates every call site that must be updated.

### What this presentation shows

```ts
export interface DeckStage {
  stageId: string;
  title?: string;
  notes?: string;
  interaction?: InteractionConfig | null;
  demoTrigger?: DemoTriggerId | null;
}

export interface Deck { id: string; name: string; stages: DeckStage[] }
export const DEFAULT_DECK: Deck;   // today's 23 stages, same order
```

`undefined` inherits from the template; explicit `null` disables. The distinction matters: a presenter who wants the deck intact but the mass-outbound call suppressed sets `demoTrigger: null` on that stage rather than deleting the slide.

### Resolution and validation

`resolveDeck(deck) → ResolvedStage[]` merges template with overrides and stamps a runtime `index`. Presenter, audience, and backend consume `ResolvedStage[]`; nothing imports a global array.

`validateDeck(deck) → DeckWarning[]` catches what reordering introduces:

- a `demoTrigger` whose `dependsOn` stage is absent (the memory SMS with no word-cloud stage)
- an unknown `stageId`
- an `llm-prompt` stage with no configured model access

These are **warnings surfaced in the HUD, not hard errors**. A presenter who wants the memory SMS with its generic fallback copy may run it.

### Response keying

`Participant.responses` becomes `Record<string, ParticipantResponse>` keyed by **stage id**. `ParticipantResponse` gains `stageId` and retains `stageIndex` for display ordering only. `InteractionConfig.stageIndex` is dropped in favour of `stageId`.

```ts
// before — breaks on any reorder or omission
const r = Object.values(responses).find(r => r.stageIndex === 10);
// after
const r = p.responses['customers-are'];
```

Previously exported data is keyed `"1"`, `"5"`, `"10"`, `"19"`. Since sessions are ended-and-exported rather than kept live, **no migration is written**: existing snapshots stay as-is in their exported files.

### Duplicate stages

Permitted. React keys in `Stage.tsx` become `` `${stageId}-${index}` ``. Showing a results slide twice is reasonable, and forbidding it costs a validation rule for no gain. Both instances share one response set, keyed by stage id.

## Application changes

### Backend

```
services/sessions.ts    control plane: allowlist CRUD, session create/get/list/end,
                        join-code generation with collision retry, phone-pool claim/release
services/sync.ts        every function gains sessionId; names via syncNames(sessionId).
                        Object names and internal logic otherwise unchanged.
routes/auth.ts          Verify start/verify/me
routes/sessions.ts      presenter-authed CRUD + deck editing + end/export
```

`GET /api/session/:code` is the **only public** session endpoint — resolves a join code to `{ sessionId, title, status }`. Rate-limited via `@fastify/rate-limit` (~10/min/IP), because a guessed code is the entire attack path.

`GET /api/token` gains a required `sessionId` and verifies the identity is a participant of that session before minting. Under namespacing the grant remains service-wide, so this check is advisory — but it localises a future tightening to one function.

`register`, `response`, `ai-prompt`, `trigger`, `admin/*` take `sessionId` and reject unless `status === 'live'`, which also stops registrations trickling in after an event ends.

**Phone pool.** New env var `TWILIO_PHONE_POOL` (comma-separated). Session creation claims a number; ending releases it. Exhaustion returns 409 listing in-use numbers and their holding sessions.

### Presenter app

A boot gate in front of the canvas (`main.tsx` currently renders straight into the 3D scene):

```
no JWT            → Login (phone → OTP)
JWT, no session   → SessionPicker (create / resume live / end + export)
session selected  → existing canvas, driven by the resolved deck
```

The store gains `sessionId`, `joinCode`, `stages: ResolvedStage[]`; `TOTAL_STAGES` becomes `stages.length`.

`BroadcastChannel('presenter-sync')` becomes `` `presenter-sync:${sessionId}` `` and localStorage keys take the same suffix. Otherwise two presenter windows for different sessions in one browser drive each other's slides.

`Stage01Opening` encodes `${AUDIENCE_URL}/j/${joinCode}` and displays the code as text beneath the QR — Space Grotesk, not Tektur, since it is not a headline.

**HUD refactor.** `NotesApp.tsx` is 346 lines with three tabs and would approach 700 with deck and allowlist editors. It splits into `notes/tabs/{NotesTab,ParticipantsTab,ControlsTab,DeckTab,AllowlistTab}.tsx` over a shared `useAdminApi` hook owning the fetch/auth-header logic currently inlined at each call site. Same behaviour, five focused files.

### Audience app

- `/j/:code` resolves the code, then stores the session under `wonder-session:{sessionId}`.
- Bare `/` shows a code-entry screen; offers to resume a single saved live session.
- `sync.ts` computes object names from `sessionId`; the token fetch and all POSTs include it.

### ConversationRelay

The one component that cannot take a `sessionId` parameter, since Twilio initiates the connection. It resolves the session from the **called** number in the `setup` event: pooled number → `phone-pool-claims` → session → participant by caller number *within* that session. This is why the number pool matters beyond tidiness — with a single shared sender, an audience member registered at two concurrent events cannot be disambiguated at all.

## Error handling

Failures occur in front of an audience with no opportunity to read a stack trace. The rule is **degrade visibly to the presenter, invisibly to the room.**

| Condition | Behaviour |
|---|---|
| Unknown join code | "That code doesn't look right" + re-entry field |
| `status: 'ended'` | "This session has finished. Thanks for joining." |
| `status: 'draft'` | "Not started yet — hang tight", polls every 5s |
| Sync connect failure | Existing 3s retry loop and `ConnectionBadge` (`App.tsx:85`), unchanged |

**Session creation** is multi-step (claim number → create 4 Sync objects → write `sessions` entry) and ordered to fail safe: the `sessions` entry is written **last**, so partial failure leaves orphaned Sync objects but never a half-live session an audience can join. Creation is retryable. `POST /api/admin/gc` sweeps Sync objects with no matching session record.

**Verify failures** are distinguished, since each calls for different presenter behaviour: `approved: false` → "Incorrect code, try again"; Twilio 429 or max-attempts → "Too many attempts, wait 10 minutes"; service unreachable → surface and log, because silent failure here means nobody gets on stage.

**Demo triggers** stay fire-and-forget with per-participant `Promise.allSettled` (as `trigger.ts:64` already does) — one bad number must never abort the other forty sends. Responses report `{ sent, failed }` so the HUD shows "38/40 sent" rather than bare success.

## Testing

The repo has no test suite; `pnpm typecheck` is the only static check. Vitest is added to `shared` **only**, covering the pure functions where a silent bug is both likely and invisible until it is on stage:

- `resolveDeck(DEFAULT_DECK)` deep-equals a frozen fixture — the regression test for the entire refactor. The fixture is captured by serialising today's `STAGES` array to `stages.fixture.json` **before** `STAGES` is deleted, so the comparison survives its removal.
- override semantics: `undefined` inherits, `null` disables
- `validateDeck` catches missing-dependency and unknown-stage cases
- join-code generation: alphabet excludes ambiguous characters, collision retry terminates
- `syncNames` round-trips and rejects an empty session id

### Two-session manual smoke checklist

Everything else — Sync wiring, Verify, the 3D stages — is verified manually. Two browsers, two decks (one reordered with a stage omitted), two phones:

1. Both sessions register participants; each participant count reflects only its own session.
2. Advancing session A moves nothing in session B.
3. `isLive` enabled on A, disabled on B; a demo stage in B sends nothing.
4. The memory SMS in the reordered deck finds the correct word-cloud answer.
5. A participant registered in both sessions receives the correct per-session voice call.
6. Ending A exports its snapshot, deletes its four Sync objects, and releases its number; B is unaffected.
7. Session A's join code, entered after A has ended, shows the "finished" screen.

This is the check that matters. An automated suite could not verify it honestly without a Twilio test harness that does not exist yet.

**Run 2026-09-07: all seven points pass.** Two live sessions, a reordered deck
with stages omitted, and one phone registered in both. Two things the run caught
and that the code now guards: Sync read-modify-write had to become conditional
(`ifMatch: revision`) because a phone registering while the presenter armed the
session silently disarmed `isLive`, and the ConversationRelay session lookup has
to pick the pool number by call *direction* — outbound places the call from it,
inbound receives on it, and reversing them looks up the wrong party without
erroring.

## Implementation order

Each step leaves the repo type-clean and runnable.

1. `shared`: capture `stages.fixture.json` from the current `STAGES`, then add `stageLibrary.ts`, deck types, `resolveDeck`, `validateDeck`, `syncNames`, `DEFAULT_DECK`, and Vitest. Delete `STAGES` once the fixture test passes.
2. Response re-keying by stage id across `shared`, `trigger.ts`, `aiPrompt.ts`.
3. Backend control plane: `services/sessions.ts`, allowlist, join codes, phone pool.
4. Backend auth: `routes/auth.ts`, `requirePresenter`, bootstrap seeding, and application of the route/auth matrix above — including Twilio signature validation on the TwiML webhooks.
5. Backend data plane: thread `sessionId` through `services/sync.ts` and all routes.
6. Audience: `/j/:code`, code entry, namespaced storage and sync.
7. Presenter: login gate, session picker, store changes, QR deep link.
8. HUD: tab split, deck editor, allowlist editor.
9. ConversationRelay: session resolution by called number.
10. Two-session smoke run.
