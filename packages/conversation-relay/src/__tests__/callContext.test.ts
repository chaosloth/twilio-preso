import { describe, expect, it, vi } from 'vitest';
import { resolveRelayConfig } from '@twilio-preso/shared';
import type { Participant } from '@twilio-preso/shared';
import { loadCallContext } from '../callContext.js';
import type { CallContextLoaders } from '../callContext.js';

function attendee(over: Partial<Participant> = {}): Participant {
  return {
    id: 'p1',
    name: 'Billy',
    phone: '+61400000001',
    registeredAt: 0,
    responses: {
      'brand-poll': {
        stageId: 'brand-poll',
        stageIndex: 0,
        type: 'poll',
        value: 'Cup Cakes Store',
        timestamp: 0,
      },
    },
    ...over,
  };
}

/** A deferred promise, so a test can hold a loader open and observe overlap. */
function gate<T>() {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function loaders(over: Partial<CallContextLoaders> = {}): CallContextLoaders {
  return {
    resolveSession: vi.fn(async () => ({ sessionId: 's1', participantPhone: '+61400000001' })),
    listParticipants: vi.fn(async () => [attendee()]),
    fetchSessionConfig: vi.fn(async () => ({ config: resolveRelayConfig(), session: null })),
    lookupProfileByPhone: vi.fn(async () => null),
    fetchProfileContext: vi.fn(async () => null),
    recallForProfile: vi.fn(async () => null),
    ...over,
  };
}

const inboundCall = { from: '+61400000001', to: '+61400000999', direction: 'inbound' };

describe('loadCallContext', () => {
  /**
   * The two reads are independent Sync calls — the participants map and the
   * control-plane sessions map — and the caller is listening to a ringing phone
   * for the sum of them. Awaiting one before starting the other is a round trip
   * of dead air for nothing.
   */
  it('reads the participants and the voice settings at the same time', async () => {
    const participants = gate<Participant[]>();
    const settings = gate<{ config: ReturnType<typeof resolveRelayConfig>; session: null }>();
    const deps = loaders({
      listParticipants: vi.fn(() => participants.promise),
      fetchSessionConfig: vi.fn(() => settings.promise),
    });

    const loading = loadCallContext(inboundCall, deps);

    // Both have been asked while neither has answered — which is only possible
    // if the second was not waiting on the first.
    await vi.waitFor(() => expect(deps.listParticipants).toHaveBeenCalledWith('s1'));
    expect(deps.fetchSessionConfig).toHaveBeenCalledWith('s1', 'inbound');

    participants.release([attendee()]);
    settings.release({ config: resolveRelayConfig(), session: null });
    const loaded = await loading;
    expect(loaded.caller.name).toBe('Billy');
  });

  it('resolves the caller out of the room and keeps the room tally', async () => {
    const loaded = await loadCallContext(inboundCall, loaders());
    expect(loaded.sessionId).toBe('s1');
    expect(loaded.callerPhone).toBe('+61400000001');
    expect(loaded.caller.inbound).toBe(true);
    expect(loaded.caller.answers.map((a) => a.answer)).toContain('Cup Cakes Store');
    expect(loaded.caller.room.length).toBeGreaterThan(0);
  });

  it('reads no memory at all when the session has it switched off', async () => {
    const deps = loaders({
      fetchSessionConfig: vi.fn(async () => ({
        config: resolveRelayConfig({ useMemory: false }),
        session: null,
      })),
    });
    await loadCallContext(inboundCall, deps);
    expect(deps.lookupProfileByPhone).not.toHaveBeenCalled();
    expect(deps.fetchProfileContext).not.toHaveBeenCalled();
  });

  /** An attendee who registered at a previous event has no id on this session's
   *  record, and the phone identifier is what still resolves them. */
  it('falls back to a phone lookup when the participant carries no profile id', async () => {
    const deps = loaders({ lookupProfileByPhone: vi.fn(async () => 'mem_1') });
    await loadCallContext(inboundCall, deps);
    expect(deps.lookupProfileByPhone).toHaveBeenCalledWith('+61400000001');
    expect(deps.fetchProfileContext).toHaveBeenCalledWith('mem_1');
  });

  it('trusts the id on the participant record and skips the lookup', async () => {
    const deps = loaders({
      listParticipants: vi.fn(async () => [attendee({ memoryProfileId: 'mem_on_record' })]),
    });
    await loadCallContext(inboundCall, deps);
    expect(deps.lookupProfileByPhone).not.toHaveBeenCalled();
    expect(deps.fetchProfileContext).toHaveBeenCalledWith('mem_on_record');
  });

  /**
   * `Recall` is a semantic index that can fail or lag while the traits are
   * already written. Losing the caller's name because the search was down is the
   * greeting sounding like nobody was found.
   */
  it('keeps the profile when recall fails, and the participant when both do', async () => {
    const deps = loaders({
      lookupProfileByPhone: vi.fn(async () => 'mem_1'),
      fetchProfileContext: vi.fn(async () => ({ traits: { Contact: { firstName: 'Bill' } } })),
      recallForProfile: vi.fn(async () => {
        throw new Error('recall is down');
      }),
    });
    const loaded = await loadCallContext(inboundCall, deps);
    expect(loaded.caller.recall).toBeNull();
    expect(loaded.caller.name).toBe('Billy');

    const bothDown = loaders({
      lookupProfileByPhone: vi.fn(async () => {
        throw new Error('memory is down');
      }),
    });
    expect((await loadCallContext(inboundCall, bothDown)).caller.name).toBe('Billy');
  });

  /** An unmatched call is still a ringing phone: defaults, and a context the
   *  greeting can be built from. */
  it('answers an unresolvable call with the defaults', async () => {
    const deps = loaders({ resolveSession: vi.fn(async () => null) });
    const loaded = await loadCallContext(inboundCall, deps);
    expect(loaded.sessionId).toBeNull();
    expect(loaded.config).toEqual(resolveRelayConfig());
    expect(deps.listParticipants).not.toHaveBeenCalled();
    expect(loaded.callerPhone).toBe('+61400000001');
  });

  /** Outbound is the finale: we dialled them, so the attendee is `to`. */
  it('takes the attendee from the far end of an outbound call', async () => {
    const deps = loaders({ resolveSession: vi.fn(async () => null) });
    const loaded = await loadCallContext(
      { from: '+61400000999', to: '+61400000001', direction: 'outbound-api' },
      deps
    );
    expect(loaded.callerPhone).toBe('+61400000001');
    expect(loaded.caller.inbound).toBe(false);
  });
});

/**
 * The session holds two voice configs and this is what chooses between them, so
 * getting it wrong is an outbound finale greeting someone as if they had rung in.
 */
describe('which direction the config is read for', () => {
  it('asks for the outbound config on a call this app placed', async () => {
    const deps = loaders();
    await loadCallContext({ from: '+61400000999', to: '+61400000001', direction: 'outbound-api' }, deps);
    expect(deps.fetchSessionConfig).toHaveBeenCalledWith('s1', 'outbound');
  });

  /**
   * The backend declares it in a custom parameter because it knows what it
   * placed, and that wins: a leg dialled out of a `<Dial>` reports a direction
   * describing the leg rather than the moment in the talk.
   */
  it('prefers the direction the TwiML declared', async () => {
    const deps = loaders();
    await loadCallContext(
      { ...inboundCall, customParameters: { sessionId: 's1', direction: 'outbound' } },
      deps
    );
    expect(deps.fetchSessionConfig).toHaveBeenCalledWith('s1', 'outbound');
  });
});

/**
 * `Recall` is a semantic search — the slowest read at setup and the one a finale
 * multiplies by the size of the room. It earns that on the twelve turns an
 * inbound caller gets; the outbound three are covered by the profile's own
 * observations, which are fetched either way.
 */
describe('recall at scale', () => {
  it('does not search memory on a call it placed', async () => {
    const deps = loaders({
      lookupProfileByPhone: vi.fn(async () => 'pr_1'),
      fetchProfileContext: vi.fn(async () => ({ traits: {}, observations: ['said a thing'] })),
    });

    const call = await loadCallContext(
      { from: '+61400000999', to: '+61400000001', direction: 'outbound-api' },
      deps
    );

    expect(deps.recallForProfile).not.toHaveBeenCalled();
    // The durable context is still read — that is where the name comes from.
    expect(deps.fetchProfileContext).toHaveBeenCalledWith('pr_1');
    expect(call.caller.recall).toBeNull();
  });

  it('still searches memory for a caller who rang in', async () => {
    const deps = loaders({
      lookupProfileByPhone: vi.fn(async () => 'pr_1'),
      recallForProfile: vi.fn(async () => 'wants to build a loyalty app'),
    });

    const call = await loadCallContext(inboundCall, deps);

    expect(deps.recallForProfile).toHaveBeenCalledTimes(1);
    expect(call.caller.recall).toBe('wants to build a loyalty app');
  });

  it('asks nothing of memory when there is no profile, in either direction', async () => {
    const deps = loaders({ lookupProfileByPhone: vi.fn(async () => null) });
    await loadCallContext(inboundCall, deps);
    expect(deps.fetchProfileContext).not.toHaveBeenCalled();
    expect(deps.recallForProfile).not.toHaveBeenCalled();
  });
});
