import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, LlmConfig, LlmRequest } from './types.js';
import { requireTokens } from './stream.js';

export function createAnthropicClient(config: LlmConfig): LlmClient {
  const client = new Anthropic({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });

  const params = (request: LlmRequest) => {
    const temperature = request.temperature ?? config.temperature;
    return {
      model: config.model,
      max_tokens: request.maxTokens ?? config.maxTokens ?? 300,
      system: request.system,
      messages: request.messages,
      ...(temperature === undefined ? {} : { temperature }),
    };
  };

  return {
    provider: 'anthropic',
    model: config.model,

    async complete(request) {
      const response = await client.messages.create(params(request));
      const text = response.content.find((block) => block.type === 'text');
      return text?.type === 'text' ? text.text.trim() : '';
    },

    stream(request) {
      const tokens = (async function* () {
        const stream = client.messages.stream(params(request));
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            yield event.delta.text;
          }
        }
      })();
      return requireTokens(tokens, 'anthropic');
    },
  };
}
