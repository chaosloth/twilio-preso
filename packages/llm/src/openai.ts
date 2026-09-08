import OpenAI from 'openai';
import type { LlmClient, LlmConfig, LlmRequest } from './types.js';
import { requireTokens } from './stream.js';

/**
 * Works against OpenAI itself and any OpenAI-compatible Chat Completions
 * endpoint — set `baseUrl` (LLM_BASE_URL) to point at OpenRouter, Groq,
 * Together, vLLM, Ollama, etc.
 */
export function createOpenAiClient(config: LlmConfig): LlmClient {
  const client = new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });

  // OpenAI takes the system prompt as the first message rather than a field.
  const params = (request: LlmRequest) => ({
    model: config.model,
    max_tokens: request.maxTokens ?? config.maxTokens ?? 300,
    temperature: request.temperature ?? config.temperature,
    messages: [
      { role: 'system' as const, content: request.system },
      ...request.messages,
    ],
  });

  return {
    provider: 'openai',
    model: config.model,

    async complete(request) {
      const response = await client.chat.completions.create({
        ...params(request),
        stream: false,
      });
      return response.choices[0]?.message?.content?.trim() ?? '';
    },

    stream(request) {
      const tokens = (async function* () {
        const stream = await client.chat.completions.create({
          ...params(request),
          stream: true,
        });
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) yield delta;
        }
      })();
      return requireTokens(tokens, `openai (${config.baseUrl ?? 'api.openai.com'})`);
    },
  };
}
