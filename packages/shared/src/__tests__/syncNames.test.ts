import { describe, expect, test } from 'vitest';
import { syncNames } from '../syncNames.js';

const SESSION = '3f9a1c2e-7b44-4d1a-9f80-2c6d5e8a1b03';

describe('syncNames', () => {
  test('returns the four data-plane object names for a session', () => {
    expect(syncNames(SESSION)).toEqual({
      state: `s_${SESSION}_presentation-state`,
      aggregate: `s_${SESSION}_aggregate-results`,
      events: `s_${SESSION}_event-stream`,
      participants: `s_${SESSION}_participants`,
    });
  });

  test('every name is prefixed with the session id', () => {
    const names = Object.values(syncNames(SESSION));
    expect(names).toHaveLength(4);
    expect(names.every((n) => n.startsWith(`s_${SESSION}_`))).toBe(true);
  });

  test('two sessions share no object name', () => {
    const a = Object.values(syncNames('aaaa'));
    const b = Object.values(syncNames('bbbb'));
    expect(a.filter((n) => b.includes(n))).toEqual([]);
  });

  test('no session name collides with a control-plane object name', () => {
    // The control plane is unprefixed: presenter-allowlist, sessions,
    // phone-pool-claims. The `s_` prefix is what keeps the planes disjoint.
    const controlPlane = ['presenter-allowlist', 'sessions', 'phone-pool-claims'];
    const names = Object.values(syncNames(SESSION));
    expect(names.filter((n) => controlPlane.includes(n))).toEqual([]);
  });

  test('rejects an empty session id', () => {
    expect(() => syncNames('')).toThrow(/session id/i);
  });

  test('rejects a whitespace-only session id', () => {
    expect(() => syncNames('   ')).toThrow(/session id/i);
  });

  test('rejects a session id containing the name separator', () => {
    // An id with an underscore could forge another session's object name.
    expect(() => syncNames('abc_def')).toThrow(/session id/i);
  });
});
