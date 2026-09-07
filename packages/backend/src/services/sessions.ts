import { randomUUID } from 'crypto';
import Twilio from 'twilio';
import { DEFAULT_DECK, allocateJoinCode, isValidJoinCode, normalizeJoinCode } from '@twilio-preso/shared';
import type {
  Deck,
  PhonePoolClaim,
  PhonePoolUsage,
  Presenter,
  PresenterRecord,
  SessionRecord,
  SessionStatus,
} from '@twilio-preso/shared';
import { config } from '../config.js';
import { initSessionSync, teardownSessionSync } from './sync.js';
import { isAlreadyExists, isNotFound } from './syncErrors.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);
const syncService = client.sync.v1.services(config.twilio.syncServiceSid);

/**
 * Control-plane maps. Unprefixed, unlike the per-session data plane — there is
 * one of each for the whole service.
 */
const PRESENTER_ALLOWLIST = 'presenter-allowlist';
const SESSIONS_MAP = 'sessions';
const PHONE_POOL_CLAIMS = 'phone-pool-claims';


/** Thrown when the pool has no free number. Routes turn this into a 409. */
export class PhonePoolExhaustedError extends Error {
  constructor(public readonly inUse: PhonePoolUsage[]) {
    super('No phone numbers available in TWILIO_PHONE_POOL.');
    this.name = 'PhonePoolExhaustedError';
  }
}

export async function initControlPlane(): Promise<void> {
  for (const uniqueName of [PRESENTER_ALLOWLIST, SESSIONS_MAP, PHONE_POOL_CLAIMS]) {
    try {
      await syncService.syncMaps.create({ uniqueName });
    } catch (e: any) {
      if (!isAlreadyExists(e)) throw e;
    }
  }
  await seedBootstrapPresenters();
}

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

export type { Presenter };

export async function listPresenters(): Promise<Presenter[]> {
  const items = await syncService.syncMaps(PRESENTER_ALLOWLIST).syncMapItems.list({ limit: 200 });
  return items.map((item) => ({ phone: item.key, ...(item.data as PresenterRecord) }));
}

export async function getPresenter(phone: string): Promise<Presenter | null> {
  try {
    const item = await syncService.syncMaps(PRESENTER_ALLOWLIST).syncMapItems(phone).fetch();
    return { phone: item.key, ...(item.data as PresenterRecord) };
  } catch {
    return null;
  }
}

/** Whether this phone may sign in. The single gate for presenter auth. */
export async function isAllowlisted(phone: string): Promise<boolean> {
  return (await getPresenter(phone)) !== null;
}

export async function addPresenter(
  phone: string,
  name: string,
  addedBy: string
): Promise<Presenter> {
  const record: PresenterRecord = { name, addedBy, addedAt: Date.now() };
  try {
    await syncService.syncMaps(PRESENTER_ALLOWLIST).syncMapItems.create({ key: phone, data: record });
  } catch (e: any) {
    if (!isAlreadyExists(e)) throw e;
    // Re-adding an existing presenter updates their name rather than failing.
    await syncService.syncMaps(PRESENTER_ALLOWLIST).syncMapItems(phone).update({ data: record });
  }
  return { phone, ...record };
}

export async function removePresenter(phone: string): Promise<void> {
  try {
    await syncService.syncMaps(PRESENTER_ALLOWLIST).syncMapItems(phone).remove();
  } catch (e: any) {
    if (!isNotFound(e)) throw e;
  }
}

/**
 * Seeds `PRESENTER_BOOTSTRAP_PHONES` if missing. An empty allowlist locks
 * everyone out with no way back in, so this runs every boot and is idempotent —
 * it also self-heals after an accidental deletion. Existing entries keep the
 * name they were given in the HUD.
 */
async function seedBootstrapPresenters(): Promise<void> {
  for (const phone of config.presenterBootstrapPhones) {
    if (await isAllowlisted(phone)) continue;
    await addPresenter(phone, phone, 'bootstrap');
  }
}

// ---------------------------------------------------------------------------
// Phone pool
// ---------------------------------------------------------------------------

async function listClaims(): Promise<Array<{ phoneNumber: string; claim: PhonePoolClaim }>> {
  const items = await syncService.syncMaps(PHONE_POOL_CLAIMS).syncMapItems.list({ limit: 200 });
  return items.map((item) => ({ phoneNumber: item.key, claim: item.data as PhonePoolClaim }));
}

/**
 * Claims the first unclaimed number in the pool.
 *
 * The create-if-absent below is what makes this safe against two presenters
 * creating a session at the same moment: Sync rejects a duplicate key, so the
 * loser sees an already-exists error and moves to the next number rather than
 * both walking away believing they own it.
 */
export async function claimPhoneNumber(sessionId: string): Promise<string> {
  const claims = new Map((await listClaims()).map((c) => [c.phoneNumber, c.claim]));

  for (const phoneNumber of config.twilio.phonePool) {
    if (claims.has(phoneNumber)) continue;
    try {
      await syncService.syncMaps(PHONE_POOL_CLAIMS).syncMapItems.create({
        key: phoneNumber,
        data: { sessionId, claimedAt: Date.now() } satisfies PhonePoolClaim,
      });
      await pointNumberAtVoiceAgent(phoneNumber, sessionId);
      return phoneNumber;
    } catch (e: any) {
      if (!isAlreadyExists(e)) throw e;
    }
  }

  throw new PhonePoolExhaustedError(await describePoolUsage());
}

/**
 * Points an inbound call at this session's voice agent.
 *
 * Without this the number answers with whatever it was last configured for, so
 * an attendee *calling back in* — the only way the agent is reachable other than
 * the mass outbound trigger — never reaches it. The session id goes in the query
 * string, which the signature covers, so the relay is told which presentation
 * the caller belongs to instead of inferring it.
 *
 * Best-effort: a number the account cannot reconfigure (or a relay that isn't
 * running) must not stop a session being created. Outbound still works.
 */
async function pointNumberAtVoiceAgent(phoneNumber: string, sessionId: string): Promise<void> {
  try {
    const [number] = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
    if (!number) return;
    const voiceUrl = process.env.CONVERSATION_RELAY_URL
      ? `${config.publicBaseUrl}/api/voice/conversation-relay?sessionId=${encodeURIComponent(sessionId)}`
      : `${config.publicBaseUrl}/api/voice/demo-bot`;
    await client.incomingPhoneNumbers(number.sid).update({ voiceUrl, voiceMethod: 'POST' });
  } catch (err) {
    console.warn(`Could not point ${phoneNumber} at the voice agent:`, err);
  }
}

export async function releasePhoneNumber(phoneNumber: string): Promise<void> {
  try {
    await syncService.syncMaps(PHONE_POOL_CLAIMS).syncMapItems(phoneNumber).remove();
  } catch (e: any) {
    if (!isNotFound(e)) throw e;
  }
}

/**
 * Which session holds each claimed number. Reported with the 409 on exhaustion
 * so the presenter can go end the stale event instead of guessing.
 */
export async function describePoolUsage(): Promise<PhonePoolUsage[]> {
  const [claims, sessions] = await Promise.all([listClaims(), listSessions()]);
  const byId = new Map(sessions.map((s) => [s.id, s]));

  return claims.map(({ phoneNumber, claim }) => {
    const session = byId.get(claim.sessionId);
    return {
      phoneNumber,
      sessionId: claim.sessionId,
      // A claim whose session record is gone is a leak from a failed creation;
      // name it as such rather than showing a blank.
      sessionTitle: session?.title ?? '(orphaned claim)',
      joinCode: session?.joinCode ?? '',
    };
  });
}

/** The number a session's calls and texts should come from. */
export async function phoneNumberForSession(sessionId: string): Promise<string | null> {
  const claims = await listClaims();
  return claims.find((c) => c.claim.sessionId === sessionId)?.phoneNumber ?? null;
}

/** Reverse lookup for ConversationRelay, which only knows the called number. */
export async function sessionIdForPhoneNumber(phoneNumber: string): Promise<string | null> {
  try {
    const item = await syncService.syncMaps(PHONE_POOL_CLAIMS).syncMapItems(phoneNumber).fetch();
    return (item.data as PhonePoolClaim).sessionId;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function listSessions(): Promise<SessionRecord[]> {
  const items = await syncService.syncMaps(SESSIONS_MAP).syncMapItems.list({ limit: 200 });
  return (items.map((item) => item.data as SessionRecord)).sort(
    (a, b) => b.createdAt - a.createdAt
  );
}

/** The join path. `code` may be whatever the audience typed. */
export async function getSessionByCode(code: string): Promise<SessionRecord | null> {
  const joinCode = normalizeJoinCode(code);
  // Skip the round-trip on input that could never be a key.
  if (!isValidJoinCode(joinCode)) return null;
  try {
    const item = await syncService.syncMaps(SESSIONS_MAP).syncMapItems(joinCode).fetch();
    return item.data as SessionRecord;
  } catch {
    return null;
  }
}

/** Keyed by join code, so an id lookup is a scan. Only used by presenter-side
 *  paths, where the list is small and already being fetched. */
export async function getSessionById(sessionId: string): Promise<SessionRecord | null> {
  const sessions = await listSessions();
  return sessions.find((s) => s.id === sessionId) ?? null;
}

export interface CreateSessionInput {
  title: string;
  ownerPhone: string;
  /** Defaults to the full deck. Snapshotted, so later edits to the default
   *  deck do not change this session. */
  deck?: Deck;
}

/**
 * Creation order is load-bearing: claim a number, create the four data-plane
 * objects, and write the `sessions` entry **last**. The sessions map is the only
 * thing an audience can reach, so a failure partway through leaves an
 * unreachable session rather than a joinable one whose Sync objects don't exist.
 * On failure we unwind what we did create.
 */
export async function createSession(input: CreateSessionInput): Promise<SessionRecord> {
  const id = randomUUID();
  const joinCode = await allocateJoinCode(async (code) => (await getSessionByCode(code)) !== null);
  const phoneNumber = await claimPhoneNumber(id);

  try {
    await initSessionSync(id);

    const session: SessionRecord = {
      id,
      joinCode,
      title: input.title,
      ownerPhone: input.ownerPhone,
      deck: input.deck ?? structuredClone(DEFAULT_DECK),
      phoneNumber,
      status: 'draft',
      createdAt: Date.now(),
    };

    await syncService.syncMaps(SESSIONS_MAP).syncMapItems.create({ key: joinCode, data: session });
    return session;
  } catch (e) {
    await teardownSessionSync(id).catch(() => {});
    await releasePhoneNumber(phoneNumber).catch(() => {});
    throw e;
  }
}

async function updateSession(
  session: SessionRecord,
  updates: Partial<SessionRecord>
): Promise<SessionRecord> {
  const updated = { ...session, ...updates };
  await syncService
    .syncMaps(SESSIONS_MAP)
    .syncMapItems(session.joinCode)
    .update({ data: updated });
  return updated;
}

export async function setSessionStatus(
  sessionId: string,
  status: SessionStatus
): Promise<SessionRecord | null> {
  const session = await getSessionById(sessionId);
  if (!session) return null;
  return updateSession(session, { status });
}

export async function setSessionDeck(
  sessionId: string,
  deck: Deck
): Promise<SessionRecord | null> {
  const session = await getSessionById(sessionId);
  if (!session) return null;
  return updateSession(session, { deck });
}

/**
 * Marks the session ended, releases its number, and deletes its four Sync
 * objects. The record itself is kept — it is the only remaining trace of the
 * event, and re-entering the code needs to show "this has finished" rather than
 * "unknown code".
 *
 * The record is written to `ended` *before* teardown, so a failure mid-teardown
 * leaves a session nobody can join, not one that is joinable with missing
 * objects. Callers should export their snapshot first: teardown is destructive.
 */
export async function endSession(sessionId: string): Promise<SessionRecord | null> {
  const session = await getSessionById(sessionId);
  if (!session) return null;
  if (session.status === 'ended') return session;

  const ended = await updateSession(session, { status: 'ended', endedAt: Date.now() });
  await releasePhoneNumber(session.phoneNumber);
  await teardownSessionSync(session.id);
  return ended;
}
