export type LlmProviderName = 'anthropic' | 'openai';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
}

/**
 * A provider-agnostic chat client. Every provider implements both a buffered
 * `complete()` and a `stream()` that yields text deltas as they arrive.
 */
export interface LlmClient {
  readonly provider: LlmProviderName;
  readonly model: string;
  complete(request: LlmRequest): Promise<string>;
  stream(request: LlmRequest): AsyncIterable<string>;
}

export interface LlmConfig {
  provider: LlmProviderName;
  model: string;
  apiKey: string;
  /**
   * Override the provider's API host. For `openai` this is what makes any
   * OpenAI-compatible endpoint work (OpenRouter, Groq, Together, Ollama, …).
   */
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}
