import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RELAY_CONFIG,
  RELAY_TOOLS,
  relayToolPrompt,
  resolveRelayConfig,
} from '../relayConfig.js';

describe('resolveRelayConfig', () => {
  it('returns the defaults when the session has no overrides', () => {
    expect(resolveRelayConfig(undefined)).toEqual(DEFAULT_RELAY_CONFIG);
  });

  it('keeps every default the override does not mention', () => {
    const resolved = resolveRelayConfig({ voice: 'Google.en-GB-Neural2-A' });
    expect(resolved.voice).toBe('Google.en-GB-Neural2-A');
    expect(resolved.language).toBe(DEFAULT_RELAY_CONFIG.language);
    expect(resolved.systemPrompt).toBe(DEFAULT_RELAY_CONFIG.systemPrompt);
  });

  it('ignores keys the config does not declare, so a foreign file cannot inject any', () => {
    const resolved = resolveRelayConfig({ hacked: true, voice: 'x' } as never);
    expect('hacked' in resolved).toBe(false);
  });

  it('merges tools by id and keeps unknown tool ids out', () => {
    const resolved = resolveRelayConfig({
      tools: [{ id: 'end_call', enabled: false }, { id: 'nope', enabled: true }] as never,
    });
    expect(resolved.tools.map((t) => t.id)).toEqual(RELAY_TOOLS.map((t) => t.id));
    expect(resolved.tools.find((t) => t.id === 'end_call')!.enabled).toBe(false);
  });

  it('clamps turn limits to at least one exchange', () => {
    expect(resolveRelayConfig({ maxTurnsInbound: 0 }).maxTurnsInbound).toBe(1);
  });
});

describe('relayToolPrompt', () => {
  it('is empty when no tool is enabled', () => {
    const config = resolveRelayConfig({ tools: RELAY_TOOLS.map((t) => ({ ...t, enabled: false })) });
    expect(relayToolPrompt(config)).toBe('');
  });

  it('names each enabled tool with its own sentinel and instructions', () => {
    const config = resolveRelayConfig({
      tools: RELAY_TOOLS.map((t) => ({ ...t, enabled: t.id === 'end_call' })),
    });
    const prompt = relayToolPrompt(config);
    expect(prompt).toContain('[[end_call]]');
    expect(prompt).not.toContain('[[handoff_to_human]]');
  });
});
