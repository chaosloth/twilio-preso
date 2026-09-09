import { buildCallerContext, tallyRoom } from '@twilio-preso/shared';
import type {
  AgentProfileContext,
  CallerContext,
  Participant,
  RelayConfig,
  SessionRecord,
} from '@twilio-preso/shared';
import type { CallSession, SetupEvent } from './session.js';

/**
 * Everything the agent needs before it can say a word, and the reads that
 * produce it.
 *
 * Injected rather than imported so this can be tested without a Twilio client:
 * the ordering below is the whole point of the module, and ordering is exactly
 * what a test of the real clients cannot see.
 */
export interface CallContextLoaders {
  resolveSession(event: SetupEvent): Promise<CallSession | null>;
  listParticipants(sessionId: string): Promise<Participant[]>;
  fetchSessionConfig(
    sessionId: string | null
  ): Promise<{ config: RelayConfig; session: SessionRecord | null }>;
  lookupProfileByPhone(phone: string | null): Promise<string | null>;
  fetchProfileContext(profileId: string | undefined): Promise<AgentProfileContext | null>;
  recallForProfile(profileId: string | undefined, query: string): Promise<string | null>;
}

export interface LoadedCall {
  /** Which presentation this call belongs to, or null if nothing matched. */
  sessionId: string | null;
  config: RelayConfig;
  session: SessionRecord | null;
  callerPhone: string | null;
  caller: CallerContext;
}

/** What the finale asks memory about. Fixed, because the call has not started. */
const RECALL_QUERY = 'customer experience challenges and what they want to build';

/**
 * Assemble the caller's context, in as few round trips as the dependencies allow.
 *
 * The caller is holding a ringing phone for the sum of these reads, so anything
 * that does not depend on another result is started alongside it:
 *
 * 1. the session — everything else is scoped to it, and there is no shortcut;
 * 2. the participants map *and* the control-plane sessions map, together. They
 *    are two independent Sync calls, and awaiting one before asking for the
 *    other was a round trip of dead air for nothing;
 * 3. the durable profile and the recall, together, once the config has said
 *    whether memory is read at all and the record has offered a profile id.
 *
 * Nothing here throws. Every failure degrades to less context on a working
 * call: an unmatched session gets the defaults, and a memory outage gets the
 * caller's name from the Sync record it already has.
 */
export async function loadCallContext(
  event: SetupEvent,
  loaders: CallContextLoaders
): Promise<LoadedCall> {
  const inbound = !(event.direction?.startsWith('outbound') ?? false);

  // The session first: participants live in a per-session map, so without one
  // there is nobody to look up. An unresolved call is still answered.
  const call = await loaders.resolveSession(event).catch((err) => {
    console.error('Failed to resolve the session for this call:', err);
    return null;
  });
  const sessionId = call?.sessionId ?? null;
  if (!call) {
    console.warn(`Call from ${event.from} to ${event.to} matched no session — greeting generically`);
  }

  const [participants, settings] = await Promise.all([
    sessionId ? loaders.listParticipants(sessionId) : Promise.resolve<Participant[]>([]),
    loaders.fetchSessionConfig(sessionId),
  ]);

  // What the room answered as a whole, from the same list the caller is found
  // in: the aggregate is what the presentation built from, and a majority can
  // differ from the person on the line.
  const room = tallyRoom(participants);
  const participant = call?.participantPhone
    ? findByPhone(participants, call.participantPhone)
    : null;
  if (call) {
    console.log(
      `Call connected: ${call.participantPhone} in session ${call.sessionId} -> ${participant?.name || 'unknown'}`
    );
  }

  const { config, session } = settings;

  // The participant record carries the profile id when they registered here.
  // Falling back to a phone lookup is what makes calling *in* work at all: an
  // inbound caller may have registered at a previous event, or not be in this
  // session's map, and the phone identifier still resolves them.
  const callerPhone = call?.participantPhone ?? (inbound ? event.from ?? null : event.to ?? null);

  // `useMemory` off is a demo choice, not a failure: it shows the agent working
  // from this session's answers alone, so the profile is not read.
  const profileId = config.useMemory
    ? participant?.memoryProfileId ?? (await warn(loaders.lookupProfileByPhone(callerPhone)))
    : null;

  // Independently, not as one rejecting `Promise.all`: `Recall` is a semantic
  // index that can fail or lag while the traits are already written, and a dead
  // search must not take the caller's name down with it. With no profile there
  // is nothing to read, and two round trips that can only answer null are
  // latency on a ringing phone.
  const [profile, recall] = profileId
    ? await Promise.all([
        warn(loaders.fetchProfileContext(profileId)),
        warn(loaders.recallForProfile(profileId, RECALL_QUERY)),
      ])
    : [null, null];

  const caller = buildCallerContext(participant, profile, inbound, room);
  caller.recall = recall;

  return { sessionId, config, session, callerPhone, caller };
}

/** Less context on a working call beats a rejected setup. */
async function warn<T>(promise: Promise<T | null>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    console.warn('Memory read failed — falling back to this session\'s own answers:', err);
    return null;
  }
}

/**
 * The caller, out of a room already in hand.
 *
 * Takes the list rather than fetching one: setup needs the whole room anyway —
 * the aggregate answers are what the finale talks about — and a second list of
 * five hundred items is latency on a ringing phone for data already read. It
 * lives here rather than beside the Sync read because it is pure, and pure is
 * what can be tested without a Twilio client.
 */
function findByPhone(participants: Participant[], phone: string): Participant | null {
  const wanted = digits(phone);
  return participants.find((p) => digits(p.phone) === wanted) ?? null;
}

const digits = (phone: string): string => phone.replace(/[^\d+]/g, '');
