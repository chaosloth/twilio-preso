import { describe, expect, it } from 'vitest';
import { DEFAULT_RELAY_CONFIG, TEXT_MEDIUM_RULE } from '../relayConfig.js';
import { DEFAULT_TEXT_CONFIG, resolveTextConfig } from '../textConfig.js';
import { buildCallerContext, systemPromptFor } from '../agentContext.js';

describe('resolveTextConfig', () => {
  it('returns the defaults when the session has no overrides', () => {
    expect(resolveTextConfig(undefined)).toEqual(DEFAULT_TEXT_CONFIG);
  });

  it('keeps every default the override does not mention', () => {
    const resolved = resolveTextConfig({ model: 'openai/gpt-4o' });
    expect(resolved.model).toBe('openai/gpt-4o');
    expect(resolved.systemPrompt).toBe(DEFAULT_TEXT_CONFIG.systemPrompt);
    expect(resolved.roomContext).toBe(DEFAULT_TEXT_CONFIG.roomContext);
  });

  it('ignores keys the config does not declare, so a foreign record cannot inject any', () => {
    const resolved = resolveTextConfig({ hacked: true, model: 'x' } as never);
    expect('hacked' in resolved).toBe(false);
  });

  it('clamps the thread limit to at least one reply', () => {
    expect(resolveTextConfig({ maxTurnsInbound: 0 }).maxTurnsInbound).toBe(1);
  });

  /** A cleared box is the presenter asking for silence on a failed turn, not for
   *  the default line back. An empty string is a value here. */
  it('keeps an emptied fallback reply rather than restoring the default', () => {
    expect(resolveTextConfig({ fallbackReply: '' }).fallbackReply).toBe('');
  });
});

describe('the default text prompt', () => {
  /**
   * The two agents are one persona in two mediums, so the text prompt is the
   * voice prompt with the medium swapped — not a separately written one that
   * drifts from it. The context placeholder and the paragraph telling the agent
   * to use what it knows are the shared spine.
   */
  it('carries the context placeholder', () => {
    expect(DEFAULT_TEXT_CONFIG.systemPrompt).toContain('{{context}}');
  });

  it('shares the voice prompt words about using what it knows', () => {
    const shared = 'Use what you know:';
    const paragraph = DEFAULT_RELAY_CONFIG.systemPrompt
      .split('\n\n')
      .find((p) => p.startsWith(shared))!;
    expect(DEFAULT_TEXT_CONFIG.systemPrompt).toContain(paragraph);
  });

  /** The spoken-form paragraph is actively wrong on a screen: it asks for
   *  "twenty dollars fifty" where the reader wants "$20.50". */
  it('drops the spoken-form guidance instead of carrying it over', () => {
    expect(DEFAULT_TEXT_CONFIG.systemPrompt).not.toMatch(/spoken aloud/i);
    expect(DEFAULT_TEXT_CONFIG.systemPrompt).toMatch(/text message/i);
  });

  it('shares the outcome instruction with the voice agent', () => {
    expect(DEFAULT_TEXT_CONFIG.outcomeInstruction).toBe(DEFAULT_RELAY_CONFIG.outcomeInstruction);
  });
});

describe('systemPromptFor on a text config', () => {
  const ctx = buildCallerContext(
    { id: 'p1', name: 'Ada', phone: '+61400000000', responses: {} } as never,
    { traits: { Contact: { firstName: 'Ada' } }, observations: ['Asked about SMS'] },
    true
  );

  it('substitutes the context into the text config the same way', () => {
    const prompt = systemPromptFor(ctx, resolveTextConfig(), { medium: 'text' });
    expect(prompt).toContain('You are speaking with Ada.');
    expect(prompt).toContain('Asked about SMS');
    expect(prompt).toContain(TEXT_MEDIUM_RULE);
    expect(prompt).not.toContain('{{context}}');
  });

  /** Tool sentinels are voice mechanics and would be delivered to the reader
   *  verbatim, so a text config has no tools to describe at all. */
  it('never names a tool sentinel', () => {
    const prompt = systemPromptFor(ctx, resolveTextConfig(), { medium: 'text' });
    expect(prompt).not.toContain('[[');
  });
});
