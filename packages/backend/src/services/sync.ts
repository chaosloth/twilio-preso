import Twilio from 'twilio';
import { config } from '../config.js';
import type { PresentationStateDoc, AggregateResultsDoc, SyncStreamEvent, Participant, ParticipantResponse } from '@twilio-preso/shared';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);
const syncService = client.sync.v1.services(config.twilio.syncServiceSid);

const PRESENTATION_STATE_DOC = 'presentation-state';
const AGGREGATE_RESULTS_DOC = 'aggregate-results';
const EVENT_STREAM = 'event-stream';
const PARTICIPANTS_MAP = 'participants';

export async function initSync(): Promise<void> {
  try {
    await syncService.documents.create({
      uniqueName: PRESENTATION_STATE_DOC,
      data: { currentStageIndex: 0, activeInteraction: null, totalParticipants: 0, isLive: true } satisfies PresentationStateDoc,
    });
  } catch (e: any) {
    if (e.code !== 54301) throw e;
  }

  try {
    await syncService.documents.create({
      uniqueName: AGGREGATE_RESULTS_DOC,
      data: { stageIndex: 0, type: 'poll', results: {}, totalResponses: 0 } satisfies AggregateResultsDoc,
    });
  } catch (e: any) {
    if (e.code !== 54301) throw e;
  }

  try {
    await syncService.syncStreams.create({ uniqueName: EVENT_STREAM });
  } catch (e: any) {
    if (e.code !== 54301) throw e;
  }

  try {
    await syncService.syncMaps.create({ uniqueName: PARTICIPANTS_MAP });
  } catch (e: any) {
    if (e.code !== 54301) throw e;
  }
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
 * Records an answer against the participant, keyed by stage index so a re-answer
 * replaces the old one. This is what makes later stages personal: the memory SMS
 * trigger, the voice agent, and the AI-prompt agent all read `responses`.
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
      responses: { ...(participant.responses || {}), [response.stageIndex]: response },
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
