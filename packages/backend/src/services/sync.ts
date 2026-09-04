import Twilio from 'twilio';
import { config } from '../config.js';
import { syncNames } from '@twilio-preso/shared';
import type { PresentationStateDoc, AggregateResultsDoc, SyncStreamEvent, Participant, ParticipantResponse, SyncObjectNames } from '@twilio-preso/shared';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);
const syncService = client.sync.v1.services(config.twilio.syncServiceSid);

const PRESENTATION_STATE_DOC = 'presentation-state';
const AGGREGATE_RESULTS_DOC = 'aggregate-results';
const EVENT_STREAM = 'event-stream';
const PARTICIPANTS_MAP = 'participants';

/** Sync's "unique name already exists". Creation is idempotent by design. */
const ALREADY_EXISTS = 54301;

/** Sync's "not found" — a delete of something already gone is a success. */
const NOT_FOUND = 54100;

async function ignoring<T>(code: number, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e: any) {
    if (e.code !== code) throw e;
    return null;
  }
}

/**
 * Creates the four data-plane objects under the given names. Idempotent, so
 * re-running it on an existing set is a no-op rather than an error.
 */
async function createDataPlane(names: SyncObjectNames, isLive: boolean): Promise<void> {
  await ignoring(ALREADY_EXISTS, () =>
    syncService.documents.create({
      uniqueName: names.state,
      data: { currentStageIndex: 0, activeInteraction: null, totalParticipants: 0, isLive } satisfies PresentationStateDoc,
    })
  );

  await ignoring(ALREADY_EXISTS, () =>
    syncService.documents.create({
      uniqueName: names.aggregate,
      data: { stageId: '', stageIndex: 0, type: 'poll', results: {}, totalResponses: 0 } satisfies AggregateResultsDoc,
    })
  );

  await ignoring(ALREADY_EXISTS, () => syncService.syncStreams.create({ uniqueName: names.events }));
  await ignoring(ALREADY_EXISTS, () => syncService.syncMaps.create({ uniqueName: names.participants }));
}

/**
 * The legacy single-presentation objects, still what every read/write function
 * below uses. Step 5 of the multi-tenant spec threads `sessionId` through those
 * and this goes away.
 *
 * `isLive: true` preserves the existing behaviour, and only applies on first
 * creation — an existing doc is never touched, so a restart cannot flip live
 * outbound traffic on or off under an operator.
 */
export async function initSync(): Promise<void> {
  await createDataPlane(
    {
      state: PRESENTATION_STATE_DOC,
      aggregate: AGGREGATE_RESULTS_DOC,
      events: EVENT_STREAM,
      participants: PARTICIPANTS_MAP,
    },
    true
  );
}

/**
 * Creates one session's four objects. A new session starts **not live**: the
 * presenter can walk the deck to rehearse without a demo-trigger stage texting
 * or calling real phones.
 */
export async function initSessionSync(sessionId: string): Promise<void> {
  await createDataPlane(syncNames(sessionId), false);
}

/**
 * Deletes one session's four objects. Without this a single Sync service
 * accumulates four objects per event forever and eventually hits service
 * limits. Tolerates missing objects so a partially-created session can still be
 * cleaned up.
 */
export async function teardownSessionSync(sessionId: string): Promise<void> {
  const names = syncNames(sessionId);
  await ignoring(NOT_FOUND, () => syncService.documents(names.state).remove());
  await ignoring(NOT_FOUND, () => syncService.documents(names.aggregate).remove());
  await ignoring(NOT_FOUND, () => syncService.syncStreams(names.events).remove());
  await ignoring(NOT_FOUND, () => syncService.syncMaps(names.participants).remove());
}

export async function publishEvent(event: SyncStreamEvent): Promise<void> {
  await syncService.syncStreams(EVENT_STREAM).streamMessages.create({ data: event });
}

export async function updatePresentationState(updates: Partial<PresentationStateDoc>): Promise<void> {
  const doc = await syncService.documents(PRESENTATION_STATE_DOC).fetch();
  await syncService.documents(PRESENTATION_STATE_DOC).update({
    data: { ...doc.data, ...updates },
  });
}

export async function updateAggregateResults(results: AggregateResultsDoc): Promise<void> {
  await syncService.documents(AGGREGATE_RESULTS_DOC).update({ data: results });
}

export async function addParticipant(participant: Participant): Promise<void> {
  await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems.create({
    key: participant.id,
    data: participant,
  });
  const items = await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems.list();
  await updatePresentationState({ totalParticipants: items.length });
}

export async function getParticipant(id: string): Promise<Participant | null> {
  try {
    const item = await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems(id).fetch();
    return item.data as Participant;
  } catch {
    return null;
  }
}

export async function updateParticipant(id: string, updates: Partial<Participant>): Promise<void> {
  const item = await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems(id).fetch();
  await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems(id).update({
    data: { ...item.data, ...updates },
  });
}

/**
 * Records an answer against the participant, keyed by stage id so a re-answer
 * replaces the old one and a reordered deck still finds it. This is what makes
 * later stages personal: the memory SMS trigger, the voice agent, and the
 * AI-prompt agent all read `responses`.
 */
export async function recordParticipantResponse(
  id: string,
  response: ParticipantResponse
): Promise<void> {
  const item = await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems(id).fetch();
  const participant = item.data as Participant;
  await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems(id).update({
    data: {
      ...participant,
      responses: { ...(participant.responses || {}), [response.stageId]: response },
    },
  });
}

export async function getAllParticipants(): Promise<Participant[]> {
  const items = await syncService.syncMaps(PARTICIPANTS_MAP).syncMapItems.list();
  return items.map((item) => item.data as Participant);
}

export function generateSyncToken(identity: string): string {
  const AccessToken = Twilio.jwt.AccessToken;
  const SyncGrant = AccessToken.SyncGrant;

  const token = new AccessToken(
    config.twilio.accountSid,
    config.twilio.apiKeySid,
    config.twilio.apiKeySecret,
    { identity }
  );

  const syncGrant = new SyncGrant({ serviceSid: config.twilio.syncServiceSid });
  token.addGrant(syncGrant);

  return token.toJwt();
}
