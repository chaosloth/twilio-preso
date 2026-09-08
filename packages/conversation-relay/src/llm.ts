import { createLlmClientFromEnv } from '@twilio-preso/llm';
import { STAGE_LIBRARY } from '@twilio-preso/shared';
import type { Participant } from '@twilio-preso/shared';
import type { ProfileContext } from './memory.js';

// VOICE_-prefixed env vars override the shared LLM_* config, so the voice agent
// can run on a lower-latency model than the on-screen agent if you want.
const llm = createLlmClientFromEnv(process.env, 'VOICE_');

/**
 * Everything the agent knows about whoever is on the line, assembled once at
 * setup. Three sources, deliberately kept distinct because they mean different
 * things: the session's own Sync responses (what this room just answered), the
 * profile's traits (who the person is), and its observations (what they have
 * said, here or at a previous event).
 */
export interface CallerContext {
  /** Best available name, from the participant record or the profile traits. */
  name: string | null;
  company: string | null;
  role: string | null;
  /** The mandatory poll choices, from the durable profile's traits — so a caller
   *  who chose them at a previous event is still known by them today. */
  choices: Array<{ label: string; value: string }>;
  /** This session's answers, as question/answer pairs. */
  answers: Array<{ question: string | null; answer: string }>;
  /** Recent observations from the durable profile, newest first. */
  observations: string[];
  /** A semantic recall, which may surface something older than the recent list. */
  recall: string | null;
  /** True when the attendee rang in rather than being called. Changes the
   *  opening line and how long the agent is willing to talk. */
  inbound: boolean;
}

/**
 * Assembles the caller context.
 *
 * The prompts come from `STAGE_LIBRARY` rather than `answeredQuestions`, which
 * needs a resolved deck: the relay is a separate process that never loads one.
 * Deck ordering is not worth a session fetch here — a phone call reads the
 * answers as a set, not a sequence.
 */
export function buildCallerContext(
  participant: Participant | null,
  profile: ProfileContext | null,
  inbound: boolean
): CallerContext {
  const contact = profile?.traits?.Contact ?? {};
  const live = profile?.traits?.['live-presentation'] ?? {};
  const traitName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');

  const answers = Object.values(participant?.responses ?? {})
    .filter((r) => r.value && r.type !== 'llm-prompt')
    .map((r) => ({
      question: STAGE_LIBRARY[r.stageId]?.interaction?.prompt ?? null,
      answer: r.value,
    }));

  return {
    name: participant?.name || traitName || null,
    company: participant?.company || live.company || null,
    role: participant?.role || live.role || null,
    choices: [
      { label: 'brand they are building for', value: live.brandName },
      { label: 'theme they chose', value: live.theme },
      { label: 'passcode channel they prefer', value: live.preferredOTPChannel },
    ].filter((c): c is { label: string; value: string } => !!c.value),
    answers,
    observations: profile?.observations ?? [],
    recall: null,
    inbound,
  };
}

/** True when there is something specific enough to personalise on. Drives the
 *  choice between an LLM greeting and the generic one. */
export function hasContext(ctx: CallerContext): boolean {
  return !!(ctx.name || ctx.answers.length || ctx.choices.length || ctx.observations.length || ctx.recall);
}

/** The context as prompt text. Empty when nothing is known. */
function describeContext(ctx: CallerContext): string {
  const lines: string[] = [];
  if (ctx.company && ctx.role) lines.push(`They are ${ctx.role} at ${ctx.company}.`);
  else if (ctx.company) lines.push(`They work at ${ctx.company}.`);
  else if (ctx.role) lines.push(`Their role is ${ctx.role}.`);

  for (const { label, value } of ctx.choices) {
    lines.push(`The ${label}: ${value}.`);
  }

  for (const { question, answer } of ctx.answers) {
    lines.push(question ? `Asked "${question}" today, they answered "${answer}".` : `They said "${answer}" today.`);
  }
  // Observations repeat some of the above when the answer was mirrored into
  // memory; capped rather than de-duplicated, since the wording differs and the
  // model reconciles them fine.
  for (const observation of ctx.observations.slice(0, 8)) {
    lines.push(`Remembered from their customer profile: ${observation}`);
  }
  if (ctx.recall) lines.push(`Conversation Memory also recalls: ${ctx.recall}`);

  return lines.length ? `\nWhat you know about them:\n- ${lines.join('\n- ')}` : '';
}

function systemPrompt(ctx: CallerContext): string {
  const name = ctx.name || 'someone whose name you do not know';

  return `You are a friendly AI voice agent at a Twilio Wonder event. You were built live on stage in under five minutes — you are the demo of how fast Twilio lets a developer ship a voice AI agent.

You are speaking with ${name}.${describeContext(ctx)}

Use what you know: refer to something specific they actually said or do, in their words, rather than talking in generalities. Never invent a detail that is not listed above, and if you know nothing about them, ask rather than guess.

Keep every reply SHORT — one or two sentences, because this is a phone call and they are standing in a room. Be warm and concrete. If they ask what you can do, say you are a ConversationRelay agent that handles real-time voice, reads a Twilio Conversation Memory customer profile, and can hand off to a human.

${
  ctx.inbound
    ? 'They chose to call in, so let them lead: answer what they ask, ask a follow-up, and stay on the line until they are done.'
    : 'You called them as part of the finale, so wrap up warmly after two or three exchanges.'
}`;
}

export async function generateResponse(
  ctx: CallerContext,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string
): Promise<string> {
  const text = await llm.complete({
    system: systemPrompt(ctx),
    maxTokens: 150,
    messages: [...conversationHistory, { role: 'user' as const, content: userMessage }],
  });

  return text || "I'm sorry, I didn't catch that. Could you say that again?";
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
export async function generateGreeting(ctx: CallerContext): Promise<string> {
  const fallback = staticGreeting(ctx);
  if (!hasContext(ctx)) return fallback;

  try {
    const text = await llm.complete({
      system: systemPrompt(ctx),
      maxTokens: 80,
      messages: [
        {
          role: 'user' as const,
          content: ctx.inbound
            ? 'Greet the caller by name in one or two sentences. Acknowledge that they rang in, mention one specific thing you know about them, and ask what they would like to talk about.'
            : 'Greet them by name in one or two sentences. Mention that every phone in the room just rang at once, refer to one specific thing you know about them, and ask them one question about it.',
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

function staticGreeting(ctx: CallerContext): string {
  const name = ctx.name || 'there';
  return ctx.inbound
    ? `Hi ${name}! Thanks for calling the agent that was just built live on stage. What would you like to ask me?`
    : `Hey ${name}! I'm the AI agent that was just built live on stage. Pretty cool that every phone in the room rang at once, right? What did you think of today's session?`;
}
