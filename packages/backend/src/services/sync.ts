import Twilio from 'twilio';
import { config } from '../config.js';
import { syncNames } from '@twilio-preso/shared';
import { ignoring, isAlreadyExists, isNotFound, isRevisionMismatch } from './syncErrors.js';
import type {
  AggregateResultsDoc,
  Participant,
  ParticipantResponse,
  PresentationStateDoc,
  SyncObjectNames,
  SyncStreamEvent,
} from '@twilio-preso/shared';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);
const syncService = client.sync.v1.services(config.twilio.syncServiceSid);

/**
 * Every object name in this file comes from here, so a session can only ever
 * touch its own four objects. `syncNames` rejects ids containing `_` — the
 * prefix separator — so a crafted id cannot address another session's objects.
 */
function names(sessionId: string): SyncObjectNames {
  return syncNames(sessionId);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Creates one session's four objects. Idempotent.
 *
 * A new session starts **not live**: the presenter can walk the whole deck to
 * rehearse without a demo-trigger stage texting or calling real phones.
 */
export async function initSessionSync(sessionId: string): Promise<void> {
  const n = names(sessionId);

  await ignoring(isAlreadyExists, () =>
    syncService.documents.create({
      uniqueName: n.state,
      data: {
        currentStageIndex: 0,
        activeInteraction: null,
        totalParticipants: 0,
        isLive: false,
      } satisfies PresentationStateDoc,
    })
  );

  await ignoring(isAlreadyExists, () =>
    syncService.documents.create({
      uniqueName: n.aggregate,
      data: {
        stageId: '',
        stageIndex: 0,
        type: 'poll',
        results: {},
        totalResponses: 0,
      } satisfies AggregateResultsDoc,
    })
  );

  await ignoring(isAlreadyExists, () => syncService.syncStreams.create({ uniqueName: n.events }));
  await ignoring(isAlreadyExists, () => syncService.syncMaps.create({ uniqueName: n.participants }));
}

/**
 * Deletes one session's four objects. Without this a single Sync service
 * accumulates four objects per event forever and eventually hits service
 * limits. Tolerates missing objects, so a partially-created session can still be
 * cleaned up.
 */
export async function teardownSessionSync(sessionId: string): Promise<void> {
  const n = names(sessionId);
  await ignoring(isNotFound, () => syncService.documents(n.state).remove());
  await ignoring(isNotFound, () => syncService.documents(n.aggregate).remove());
  await ignoring(isNotFound, () => syncService.syncStreams(n.events).remove());
  await ignoring(isNotFound, () => syncService.syncMaps(n.participants).remove());
}

// ---------------------------------------------------------------------------
// State, events, aggregates
// ---------------------------------------------------------------------------

export async function publishEvent(sessionId: string, event: SyncStreamEvent): Promise<void> {
  await syncService.syncStreams(names(sessionId).events).streamMessages.create({ data: event });
}

export async function getPresentationState(
  sessionId: string
): Promise<PresentationStateDoc | null> {
  try {
    const doc = await syncService.documents(names(sessionId).state).fetch();
    return doc.data as PresentationStateDoc;
  } catch {
    return null;
  }
}

/**
 * Merge fields into the state document under optimistic concurrency.
 *
 * A plain fetch-then-update loses whichever write lands second, and the field
 * that gets lost is `isLive`: a registration arriving while the presenter arms
 * the session re-writes the count from a doc fetched before the arm and silently
 * disarms it — or, worse, re-arms a session the presenter just disarmed. `If-Match`
 * turns that into a 412 we retry against the fresh revision instead.
 */
export async function updatePresentationState(
  sessionId: string,
  updates: Partial<PresentationStateDoc>
): Promise<void> {
  const name = names(sessionId).state;
  for (let attempt = 0; attempt < 5; attempt++) {
    const doc = await syncService.documents(name).fetch();
    try {
      await syncService.documents(name).update({
        data: { ...doc.data, ...updates },
        ifMatch: doc.revision,
      });
      return;
    } catch (err) {
      if (!isRevisionMismatch(err) || attempt === 4) throw err;
    }
  }
}

/** Whether this session's outbound Twilio traffic is armed. */
export async function isSessionLive(sessionId: string): Promise<boolean> {
  return (await getPresentationState(sessionId))?.isLive === true;
}

export async function updateAggregateResults(
  sessionId: string,
  results: AggregateResultsDoc
): Promise<void> {
  await syncService.documents(names(sessionId).aggregate).update({ data: results });
}

export async function resetAggregateResults(sessionId: string): Promise<void> {
  await updateAggregateResults(sessionId, {
    stageId: '',
    stageIndex: 0,
    type: 'poll',
    results: {},
    totalResponses: 0,
  });
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export async function addParticipant(
  sessionId: string,
  participant: Participant
): Promise<void> {
  const name = names(sessionId).participants;
  await syncService.syncMaps(name).syncMapItems.create({
    key: participant.id,
    data: participant,
  });
  const items = await syncService.syncMaps(name).syncMapItems.list({ limit: 1000 });
  await updatePresentationState(sessionId, { totalParticipants: items.length });
}

export async function getParticipant(
  sessionId: string,
  id: string
): Promise<Participant | null> {
  try {
    const item = await syncService.syncMaps(names(sessionId).participants).syncMapItems(id).fetch();
    return item.data as Participant;
  } catch {
    return null;
  }
}

/**
 * Same optimistic-concurrency treatment as the state doc, for the same reason:
 * two answers submitted at once (a phone re-answering while an AI prompt lands)
 * would otherwise drop one of them, and `responses` is what the memory SMS and
 * the voice agent read back.
 */
export async function updateParticipant(
  sessionId: string,
  id: string,
  updates: Partial<Participant>
): Promise<void> {
  const name = names(sessionId).participants;
  for (let attempt = 0; attempt < 5; attempt++) {
    const item = await syncService.syncMaps(name).syncMapItems(id).fetch();
    try {
      await syncService.syncMaps(name).syncMapItems(id).update({
        data: { ...item.data, ...updates },
        ifMatch: item.revision,
      });
      return;
    } catch (err) {
      if (!isRevisionMismatch(err) || attempt === 4) throw err;
    }
  }
}

export async function removeParticipant(sessionId: string, id: string): Promise<boolean> {
  const removed = await ignoring(isNotFound, () =>
    syncService.syncMaps(names(sessionId).participants).syncMapItems(id).remove()
  );
  if (removed === null) return false;
  const items = await syncService
    .syncMaps(names(sessionId).participants)
    .syncMapItems.list({ limit: 1000 });
  await updatePresentationState(sessionId, { totalParticipants: items.length });
  return true;
}

/**
 * Records an answer against the participant, keyed by stage id so a re-answer
 * replaces the old one and a reordered deck still finds it. This is what makes
 * later stages personal: the memory SMS trigger, the voice agent, and the
 * AI-prompt agent all read `responses`.
 */
export async function recordParticipantResponse(
  sessionId: string,
  id: string,
  response: ParticipantResponse
): Promise<void> {
  const name = names(sessionId).participants;
  for (let attempt = 0; attempt < 5; attempt++) {
    const item = await syncService.syncMaps(name).syncMapItems(id).fetch();
    const participant = item.data as Participant;
    try {
      await syncService.syncMaps(name).syncMapItems(id).update({
        data: {
          ...participant,
          responses: { ...(participant.responses || {}), [response.stageId]: response },
        },
        ifMatch: item.revision,
      });
      return;
    } catch (err) {
      // Two answers landing together — a poll and an AI prompt, say — would
      // otherwise drop one; retry against the revision that won.
      if (!isRevisionMismatch(err) || attempt === 4) throw err;
    }
  }
}

export async function getAllParticipants(sessionId: string): Promise<Participant[]> {
  try {
    const items = await syncService
      .syncMaps(names(sessionId).participants)
      .syncMapItems.list({ limit: 1000 });
    return items.map((item) => item.data as Participant);
  } catch (e) {
    // A torn-down session has no map. An empty roster is the truthful answer.
    if (isNotFound(e)) return [];
    throw e;
  }
}

/** Deletes and recreates the roster — the `admin/reset` path. */
export async function resetParticipants(sessionId: string): Promise<void> {
  const name = names(sessionId).participants;
  await ignoring(isNotFound, () => syncService.syncMaps(name).remove());
  await ignoring(isAlreadyExists, () => syncService.syncMaps.create({ uniqueName: name }));
  await updatePresentationState(sessionId, {
    currentStageIndex: 0,
    activeInteraction: null,
    totalParticipants: 0,
  });
  await resetAggregateResults(sessionId);
}

/**
 * Finds a participant by phone number within one session. This is why the phone
 * pool matters: the same attendee may be registered at two concurrent events,
 * and an account-wide search could not tell those registrations apart.
 */
export async function findParticipantByPhone(
  sessionId: string,
  phone: string
): Promise<Participant | null> {
  const participants = await getAllParticipants(sessionId);
  return participants.find((p) => p.phone === phone) ?? null;
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * The Sync grant remains **service-wide** under namespacing, so this token can
 * technically reach another session's objects. Session ids are not discoverable
 * without a join code and that lookup is rate-limited, which is acceptable for
 * trusted internal use; tightening to per-identity ACLs is a change here and in
 * the token route rather than an audit of every call site.
 */
export function generateSyncToken(identity: string): string {
  const AccessToken = Twilio.jwt.AccessToken;
  const SyncGrant = AccessToken.SyncGrant;

  const token = new AccessToken(
    config.twilio.accountSid,
    config.twilio.apiKeySid,
    config.twilio.apiKeySecret,
    { identity }
  );

  token.addGrant(new SyncGrant({ serviceSid: config.twilio.syncServiceSid }));

  return token.toJwt();
}
