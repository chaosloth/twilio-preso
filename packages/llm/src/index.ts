import { createAnthropicClient } from './anthropic.js';
import { createOpenAiClient } from './openai.js';
import type { LlmClient, LlmConfig, LlmProviderName } from './types.js';

export type { LlmClient, LlmConfig, LlmMessage, LlmProviderName, LlmRequest } from './types.js';

const PROVIDERS: Record<LlmProviderName, (config: LlmConfig) => LlmClient> = {
  anthropic: createAnthropicClient,
  openai: createOpenAiClient,
};

const DEFAULT_MODELS: Record<LlmProviderName, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
};

/**
 * OpenRouter speaks the OpenAI Chat Completions protocol, so it needs no
 * provider of its own — it is `openai` pointed at another host. It is the
 * default credential because one key there reaches every model the talk might
 * want, including Claude, without a second account per provider.
 */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
/** OpenRouter namespaces model ids; a bare `gpt-4o-mini` is a 400 there. */
const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-4o-mini';

export function createLlmClient(config: LlmConfig): LlmClient {
  const factory = PROVIDERS[config.provider];
  if (!factory) {
    throw new Error(
      `Unknown LLM provider "${config.provider}". Supported: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }
  return factory(config);
}

/**
 * Build LLM config from the environment. Every server package uses this so the
 * provider and model are swappable without code changes:
 *
 *   LLM_PROVIDER   anthropic | openai            (default: openai)
 *   LLM_MODEL      provider model id             (default: per-provider above)
 *   LLM_API_KEY    key; falls back to OPENROUTER_API_KEY, then
 *                  OPENAI_API_KEY / ANTHROPIC_API_KEY
 *   LLM_BASE_URL   optional API host override — with provider=openai this
 *                  targets any OpenAI-compatible endpoint (OpenRouter, Groq,
 *                  Together, vLLM, Ollama, …)
 *
 * With nothing but `OPENROUTER_API_KEY` set, this resolves to OpenRouter: one
 * key, one host, every model — which is why it is the default.
 *   LLM_MAX_TOKENS / LLM_TEMPERATURE  optional defaults
 *
 * `prefix` lets one process hold a second, independently configured client
 * (e.g. VOICE_LLM_MODEL for the voice agent) while sharing these fallbacks.
 */
export function llmConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  prefix = ''
): LlmConfig {
  const read = (name: string): string | undefined =>
    (prefix ? env[`${prefix}${name}`] : undefined) ?? env[name];

  // OpenAI is the default: every experience — the AI-prompt slide and the voice
  // agent alike — runs on the one OpenAI credential unless a deployment says
  // otherwise. Set LLM_PROVIDER=anthropic to go back.
  const provider = (read('LLM_PROVIDER') || 'openai') as LlmProviderName;
  if (!PROVIDERS[provider]) {
    throw new Error(
      `Invalid LLM_PROVIDER "${provider}". Supported: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }

  // OpenRouter first, and only when nothing more specific was asked for: an
  // explicit LLM_API_KEY or LLM_BASE_URL means the deployment has chosen a host,
  // and silently redirecting it at OpenRouter would send that key elsewhere.
  const explicitKey = read('LLM_API_KEY');
  const explicitBase = read('LLM_BASE_URL');
  const viaOpenRouter =
    provider === 'openai' && !explicitKey && !explicitBase && !!env.OPENROUTER_API_KEY;

  const apiKey =
    explicitKey ||
    (viaOpenRouter ? env.OPENROUTER_API_KEY : undefined) ||
    (provider === 'anthropic' ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error(
      `Missing API key for LLM provider "${provider}". Set LLM_API_KEY (or ${
        provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENROUTER_API_KEY / OPENAI_API_KEY'
      }).`
    );
  }

  const maxTokens = read('LLM_MAX_TOKENS');
  const temperature = read('LLM_TEMPERATURE');

  return {
    provider,
    model:
      read('LLM_MODEL') ||
      (viaOpenRouter ? OPENROUTER_DEFAULT_MODEL : DEFAULT_MODELS[provider]),
    apiKey,
    baseUrl: explicitBase || (viaOpenRouter ? OPENROUTER_BASE_URL : undefined),
    maxTokens: maxTokens ? parseInt(maxTokens, 10) : undefined,
    temperature: temperature ? parseFloat(temperature) : undefined,
  };
}

export function createLlmClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  prefix = ''
): LlmClient {
  return createLlmClient(llmConfigFromEnv(env, prefix));
}
