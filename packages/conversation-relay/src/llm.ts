import { createLlmClientFromEnv } from '@twilio-preso/llm';
import type { Participant } from '@twilio-preso/shared';

// VOICE_-prefixed env vars override the shared LLM_* config, so the voice agent
// can run on a lower-latency model than the on-screen agent if you want.
const llm = createLlmClientFromEnv(process.env, 'VOICE_');

export async function generateResponse(
  participant: Participant | null,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(participant);

  const text = await llm.complete({
    system: systemPrompt,
    maxTokens: 150,
    messages: [...conversationHistory, { role: 'user' as const, content: userMessage }],
  });

  return text || "I'm sorry, I didn't catch that. Could you say that again?";
}

function buildSystemPrompt(participant: Participant | null): string {
  const name = participant?.name || 'friend';
  const challenge = participant?.responses?.[8]?.value || null;
  const excitedProduct = participant?.responses?.[15]?.value || null;

  let context = '';
  if (challenge) {
    context += `\nThey mentioned "${challenge}" as their biggest CX challenge during the presentation.`;
  }
  if (excitedProduct) {
    context += `\nThey expressed interest in ${excitedProduct}.`;
  }

  return `You are a friendly AI assistant at a Twilio Wonder event. You were just built live on stage in under 5 minutes — you're a demo of how fast Twilio enables developers to deploy voice AI agents.

You're speaking with ${name}.${context}

Keep responses SHORT (1-2 sentences max — this is a phone call). Be warm, impressed they're at the event, and briefly reference what you know about them. If they ask what you can do, explain you're a ConversationRelay-powered agent that can handle real-time voice conversations, look up customer data, and seamlessly hand off to humans.

End the conversation gracefully after 2-3 exchanges by thanking them and saying goodbye. Do not ramble. Sound natural and conversational.`;
}

export function generateGreeting(participant: Participant | null): string {
  const name = participant?.name || 'there';
  return `Hey ${name}! I'm the AI agent that was just built live on stage. Pretty cool that every phone in the room rang at once, right? What did you think of today's session?`;
}
