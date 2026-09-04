import { createLlmClientFromEnv } from '@twilio-preso/llm';
import type { Participant } from '@twilio-preso/shared';
import { STAGES } from '../deck.js';

const llm = createLlmClientFromEnv();

const SYSTEM_PROMPT = `You are a friendly AI agent at a Twilio "Wonder" developer event. You were just built live on stage using the Twilio MCP server, which gives coding agents direct access to Twilio's entire API surface — 1,800+ endpoints across 30+ products.

An audience member is prompting you from their phone, and your reply is shown on the big screen behind the presenter. Answer their question helpfully and accurately, favouring Twilio APIs and products where relevant.

Keep responses SHORT — 2-3 sentences, big-screen friendly. Be warm and a little playful. If they ask what you are, explain you're a live demo of how fast Twilio + an MCP-equipped coding agent can ship an AI agent. Never use markdown or code fences; plain sentences only.`;

const FALLBACK = "Hmm, I didn't quite catch that — try asking again!";

function buildParticipantContext(participant: Participant | null): string {
  if (!participant) return '';

  const lines: string[] = [];
  if (participant.company) lines.push(`They work at ${participant.company}.`);
  if (participant.role) lines.push(`Their role is ${participant.role}.`);

  const responses = Object.values(participant.responses || {})
    .filter((r) => r.value && r.type !== 'llm-prompt')
    .sort((a, b) => a.stageIndex - b.stageIndex);

  const answers = responses.map((r) => {
    const prompt = STAGES[r.stageIndex]?.interaction?.prompt;
    return prompt ? `- "${prompt}" → ${r.value}` : `- ${r.value}`;
  });

  if (answers.length) {
    lines.push(
      `Earlier in the presentation they answered these audience questions:\n${answers.join('\n')}`
    );
  }

  if (!lines.length) return '';

  return `\n\nWhat you know about the person asking (${participant.name}):\n${lines.join(
    '\n'
  )}\n\nWeave this in naturally when it's relevant — it makes the answer feel personal. Don't recite it back to them or mention it if it has nothing to do with what they asked.`;
}

function buildRequest(userPrompt: string, name?: string, participant?: Participant | null) {
  return {
    system: SYSTEM_PROMPT + buildParticipantContext(participant ?? null),
    maxTokens: 200,
    messages: [
      {
        role: 'user' as const,
        content: name ? `(${name} asks) ${userPrompt}` : userPrompt,
      },
    ],
  };
}

export async function generateAiResponse(
  userPrompt: string,
  name?: string,
  participant?: Participant | null
): Promise<string> {
  const text = await llm.complete(buildRequest(userPrompt, name, participant));
  return text.trim() || FALLBACK;
}

/** Yields text deltas as the model produces them. */
export function streamAiResponse(
  userPrompt: string,
  name?: string,
  participant?: Participant | null
): AsyncIterable<string> {
  return llm.stream(buildRequest(userPrompt, name, participant));
}

export const llmInfo = { provider: llm.provider, model: llm.model };
