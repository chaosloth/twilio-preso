import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeOrchestrator, webhookUrl } from '../orchestrator.js';

/**
 * The account can hold several configurations, and the one this deployment is
 * meant to drive is named by `TWILIO_CONVERSATION_ORCHESTRATION_CONFIG_ID`. That
 * id is the answer when it is set: matching by display name instead finds
 * whichever configuration happens to carry the name, which on an account that
 * has been demoed against twice is not the one the presenter configured.
 */
type Call = { method: string; path: string };

function stub(handlers: (path: string) => unknown | undefined): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: any = {}) => {
    const path = String(url).replace('https://conversations.twilio.com/v2', '');
    calls.push({ method: init.method ?? 'GET', path });
    const answer = handlers(path);
    if (answer === undefined) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(answer), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('describeOrchestrator', () => {
  it('reads the configuration the env names, without listing the account', () => {
    const calls = stub((path) =>
      path === '/ControlPlane/Configurations/GXtest'
        ? {
            id: 'GXtest',
            displayName: 'something a colleague named it',
            statusCallbacks: [{ url: webhookUrl() }],
          }
        : undefined
    );
    return describeOrchestrator().then((state) => {
      expect(state).toMatchObject({
        configured: true,
        configurationId: 'GXtest',
        callbackMatches: true,
      });
      expect(calls.map((c) => c.path)).toEqual(['/ControlPlane/Configurations/GXtest']);
    });
  });

  /** A callback pointing at a tunnel that has since died is the failure this row
   *  exists to catch: the account is configured and texts reach nothing here. */
  it('reports the registered URL when it is not this backend', async () => {
    stub((path) =>
      path === '/ControlPlane/Configurations/GXtest'
        ? { id: 'GXtest', statusCallbacks: [{ url: 'https://dead-tunnel.example/api/orchestrator/webhook' }] }
        : undefined
    );
    const state = await describeOrchestrator();
    expect(state.callbackMatches).toBe(false);
    expect(state.registeredCallback).toBe('https://dead-tunnel.example/api/orchestrator/webhook');
    expect(state.configuredId).toBe('GXtest');
  });

  /**
   * An id that names nothing — a configuration deleted in the Console, or an env
   * var copied from another account — must fall back to the name rather than
   * report "no configuration" and offer to create a second one.
   */
  it('falls back to matching by display name when the id names nothing', async () => {
    const calls = stub((path) =>
      path.startsWith('/ControlPlane/Configurations?')
        ? { configurations: [{ id: 'GXfound', displayName: 'wonder-preso', statusCallbacks: [{ url: webhookUrl() }] }] }
        : undefined
    );
    const state = await describeOrchestrator();
    expect(state.configurationId).toBe('GXfound');
    expect(state.idMatches).toBe(false);
    expect(calls.some((c) => c.path.startsWith('/ControlPlane/Configurations?'))).toBe(true);
  });
});
