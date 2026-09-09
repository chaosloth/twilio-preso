import { createLlmClient, llmConfigFromEnv } from '@twilio-preso/llm';
import type { LlmClient } from '@twilio-preso/llm';
import { hasContext, systemPromptFor } from '@twilio-preso/shared';
import type { CallerContext, RelayConfig } from '@twilio-preso/shared';

/**
 * The caller context and the prompt assembly live in `@twilio-preso/shared`, so
 * the text agent on the backend is driven by the same persona, the same context
 * block and the same room result as this one. Re-exported here because the rest
 * of the relay imports them from this module, and because a `ProfileContext`
 * from `./memory.js` is structurally the `AgentProfileContext` they take.
 */
export { buildCallerContext, hasContext, systemPromptFor } from '@twilio-preso/shared';
export type { CallerContext } from '@twilio-preso/shared';

/**
 * VOICE_-prefixed env vars override the shared LLM_* config, so the voice agent
 * can run on a lower-latency model than the on-screen agent — and a session may
 * override the model again from the HUD.
 *
 * Clients are cached per model: building one per turn would re-read the env and
 * allocate an SDK client in the middle of a phone call.
 */
const clients = new Map<string, LlmClient>();

function llmFor(model: string): LlmClient {
  const base = llmConfigFromEnv(process.env, 'VOICE_');
  const resolved = model || base.model;
  let client = clients.get(resolved);
  if (!client) {
    client = createLlmClient({ ...base, model: resolved });
    clients.set(resolved, client);
  }
  return client;
}


export async function generateResponse(
  ctx: CallerContext,
  config: RelayConfig,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string
): Promise<string> {
  const text = await llmFor(config.model).complete({
    system: systemPromptFor(ctx, config),
    maxTokens: 150,
    messages: [...conversationHistory, { role: 'user' as const, content: userMessage }],
  });

  return text || "I'm sorry, I didn't catch that. Could you say that again?";
}

/**
 * The same turn, streamed.
 *
 * A buffered completion means the caller hears nothing until the model has
 * written its last token — which is what "slow in turn taking" was. Streaming
 * hands the first clause to TTS while the rest is still being generated, so the
 * pause after they stop speaking is one clause long instead of one reply long.
 */
export function streamResponse(
  ctx: CallerContext,
  config: RelayConfig,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string
): AsyncIterable<string> {
  return llmFor(config.model).stream({
    system: systemPromptFor(ctx, config),
    maxTokens: 150,
    messages: [...conversationHistory, { role: 'user' as const, content: userMessage }],
  });
}

/**
 * The opening line, written for this caller.
 *
 * Generated rather than templated so it can open on something they said — which
 * is the whole point of the demo — but a greeting is the one turn that cannot be
 * allowed to fail: a dead model or an empty answer here is silence on a ringing
 * phone. So a static greeting is always computed first and returned whenever the
 * model does not produce something usable.
 */
export async function generateGreeting(
  ctx: CallerContext,
  config: RelayConfig
): Promise<string> {
  const fallback = staticGreeting(ctx, config);
  if (!config.generateGreeting || !hasContext(ctx)) return fallback;

  try {
    const text = await llmFor(config.model).complete({
      system: systemPromptFor(ctx, config, { opening: true }),
      maxTokens: 80,
      messages: [
        {
          role: 'user' as const,
          content: ctx.inbound
            ? `${config.greetingInstruction} They rang in, so acknowledge that.`
            : `${config.greetingInstruction} Mention that every phone in the room just rang at once.`,
        },
      ],
    });
    const greeting = text?.trim();
    return greeting && greeting.length > 0 ? greeting : fallback;
  } catch (err) {
    console.error('Greeting generation failed, using the static greeting:', err);
    return fallback;
  }
}

/** The opening line that always exists, from the session's own template. */
function staticGreeting(ctx: CallerContext, config: RelayConfig): string {
  return config.staticGreeting.replace(/\{\{name\}\}/g, ctx.name || 'there');
}
