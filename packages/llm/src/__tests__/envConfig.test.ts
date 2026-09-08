import { describe, expect, it } from 'vitest';
import { llmConfigFromEnv } from '../index.js';

/**
 * The environment is the only place a provider is chosen, so these cases are
 * the contract every package shares: one credential, one host, whatever the
 * caller happens to be.
 */
describe('llmConfigFromEnv', () => {
  it('defaults to OpenRouter when only OPENROUTER_API_KEY is set', () => {
    const config = llmConfigFromEnv({ OPENROUTER_API_KEY: 'or-key' } as NodeJS.ProcessEnv);
    expect(config.provider).toBe('openai');
    expect(config.apiKey).toBe('or-key');
    expect(config.baseUrl).toBe('https://openrouter.ai/api/v1');
    // A bare "gpt-4o-mini" is a 400 on OpenRouter: models are namespaced there.
    expect(config.model).toBe('openai/gpt-4o-mini');
  });

  it('prefers OpenRouter over a plain OpenAI key', () => {
    const config = llmConfigFromEnv({
      OPENROUTER_API_KEY: 'or-key',
      OPENAI_API_KEY: 'oa-key',
    } as NodeJS.ProcessEnv);
    expect(config.apiKey).toBe('or-key');
  });

  it('falls back to OpenAI proper when OpenRouter is not configured', () => {
    const config = llmConfigFromEnv({ OPENAI_API_KEY: 'oa-key' } as NodeJS.ProcessEnv);
    expect(config.provider).toBe('openai');
    expect(config.apiKey).toBe('oa-key');
    expect(config.baseUrl).toBeUndefined();
    expect(config.model).toBe('gpt-4o-mini');
  });

  it('leaves an explicit provider, model and host alone', () => {
    const config = llmConfigFromEnv({
      OPENROUTER_API_KEY: 'or-key',
      LLM_PROVIDER: 'anthropic',
      LLM_MODEL: 'claude-haiku-4-5-20251001',
      LLM_API_KEY: 'explicit',
      LLM_BASE_URL: 'https://example.test',
    } as NodeJS.ProcessEnv);
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-haiku-4-5-20251001');
    expect(config.apiKey).toBe('explicit');
    expect(config.baseUrl).toBe('https://example.test');
  });

  it('lets a VOICE_ prefix override the shared config without losing the key', () => {
    const config = llmConfigFromEnv(
      { OPENROUTER_API_KEY: 'or-key', VOICE_LLM_MODEL: 'anthropic/claude-haiku-4.5' } as NodeJS.ProcessEnv,
      'VOICE_'
    );
    expect(config.model).toBe('anthropic/claude-haiku-4.5');
    expect(config.apiKey).toBe('or-key');
    expect(config.baseUrl).toBe('https://openrouter.ai/api/v1');
  });

  it('throws when no credential is present at all', () => {
    expect(() => llmConfigFromEnv({} as NodeJS.ProcessEnv)).toThrow(/OPENROUTER_API_KEY/);
  });
});
