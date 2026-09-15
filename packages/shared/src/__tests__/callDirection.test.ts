import { describe, expect, it } from 'vitest';
import { directionOf, relayConfigFor, storedRelayFor } from '../relayConfig.js';

/**
 * Two stored voice configs, one per direction. The inbound number's webhook reads
 * one and every call this app places reads the other — and the whole migration is
 * the fallback: a session that has never had its outbound tab saved must answer
 * both directions exactly as it did before the split existed.
 */
describe('storedRelayFor', () => {
  const relay = { staticGreeting: 'rang in' };
  const relayOutbound = { staticGreeting: 'we called you' };

  it('reads the inbound config for a call that rang in', () => {
    expect(storedRelayFor({ relay, relayOutbound }, 'inbound')).toBe(relay);
  });

  it('reads the outbound config for a call this app placed', () => {
    expect(storedRelayFor({ relay, relayOutbound }, 'outbound')).toBe(relayOutbound);
  });

  it('falls back to the inbound config when outbound was never saved', () => {
    expect(storedRelayFor({ relay }, 'outbound')).toBe(relay);
  });

  it('never falls the other way — an inbound call cannot read the finale', () => {
    expect(storedRelayFor({ relayOutbound }, 'inbound')).toBeUndefined();
  });

  it('resolves defaults for a session it knows nothing about', () => {
    expect(relayConfigFor(null, 'outbound').staticGreeting).toBeTruthy();
  });

  /** Stored as a partial, so a field added after the session was created still
   *  arrives as its new default in both directions. */
  it('resolves each direction field by field', () => {
    const session = { relay, relayOutbound };
    expect(relayConfigFor(session, 'inbound').staticGreeting).toBe('rang in');
    expect(relayConfigFor(session, 'outbound').staticGreeting).toBe('we called you');
    expect(relayConfigFor(session, 'outbound').voice).toBe(relayConfigFor(null, 'outbound').voice);
  });
});

describe('directionOf', () => {
  it('trusts what the backend declared', () => {
    expect(directionOf('outbound', 'inbound')).toBe('outbound');
    expect(directionOf('inbound', 'outbound-api')).toBe('inbound');
  });

  /** Twilio reports `outbound-api` and `outbound-dial`, so the prefix is the test
   *  — matching the whole word would read every placed call as inbound. */
  it('falls back to the prefix of Twilio’s own direction', () => {
    expect(directionOf(undefined, 'outbound-api')).toBe('outbound');
    expect(directionOf(undefined, 'outbound-dial')).toBe('outbound');
    expect(directionOf(undefined, 'inbound')).toBe('inbound');
  });

  /**
   * Inbound is the safe default: it is what a number configured by hand — with
   * neither a declared direction nor a webhook body this app wrote — is doing.
   */
  it('defaults to inbound, and ignores a value that is neither', () => {
    expect(directionOf(undefined, undefined)).toBe('inbound');
    expect(directionOf('sideways', undefined)).toBe('inbound');
  });
});
