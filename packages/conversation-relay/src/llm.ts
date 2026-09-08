import { createLlmClient, llmConfigFromEnv } from '@twilio-preso/llm';
import type { LlmClient } from '@twilio-preso/llm';
import { MID_CONVERSATION_RULE, STAGE_LIBRARY, relayToolPrompt } from '@twilio-preso/shared';
import type { Participant, RelayConfig, RoomTally } from '@twilio-preso/shared';
import type { ProfileContext } from './memory.js';

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
  /** This session's answers. The stage id is carried so the room's collective
   *  answer to the same question can be compared with theirs. */
  answers: Array<{ stageId: string; question: string | null; answer: string }>;
  /**
   * What the whole room answered, question by question. Separate from `answers`
   * because they mean different things and the agent must not conflate them:
   * `answers` is what this person said, `room` is what the presentation built.
   */
  room: RoomTally[];
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
  inbound: boolean,
  room: RoomTally[] = []
): CallerContext {
  const contact = profile?.traits?.Contact ?? {};
  const live = profile?.traits?.['live-presentation'] ?? {};
  const traitName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');

  const answers = Object.values(participant?.responses ?? {})
    .filter((r) => r.value && r.type !== 'llm-prompt')
    .map((r) => ({
      stageId: r.stageId,
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
    room,
    inbound,
  };
}

/** True when there is something specific enough to personalise on. Drives the
 *  choice between an LLM greeting and the generic one. */
export function hasContext(ctx: CallerContext): boolean {
  return !!(
    ctx.name ||
    ctx.answers.length ||
    ctx.choices.length ||
    ctx.observations.length ||
    ctx.room.length ||
    ctx.recall
  );
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

/**
 * What the room decided, as prompt text.
 *
 * Every tally is rendered, whatever question produced it — a poll added to the
 * deck next month reaches the agent through this with no change here. The counts
 * go in because "twelve of nineteen" is a different thing to say than "just
 * over half", and a tie is stated as a tie: an agent that announces a winner a
 * coin-toss picked is worse than one that says the room was split.
 *
 * Where the caller's own answer differs from the room's, that is said outright.
 * It is the sentence the finale is built on — what we built follows the majority,
 * and this caller may have voted the other way.
 */
function describeRoom(ctx: CallerContext): string {
  if (!ctx.room.length) return '';

  const lines = ctx.room.map((tally) => {
    const question = tally.question ?? tally.stageId;
    const mine = ctx.answers.find((a) => a.stageId === tally.stageId)?.answer;

    const verdict = tally.tie
      ? `the room was split — ${tally.counts
          .filter((c) => c.count === tally.winnerCount)
          .map((c) => `"${c.value}"`)
          .join(' and ')} tied on ${tally.winnerCount} each`
      : `the room chose "${tally.winner}" (${tally.winnerCount} of ${tally.total})`;

    if (!mine) return `"${question}" — ${verdict}.`;

    const agrees = mine.trim().toLowerCase() === tally.winner.toLowerCase();
    return agrees
      ? `"${question}" — ${verdict}, which is what they chose too.`
      : `"${question}" — ${verdict}, but they chose "${mine}", so their own choice differs from the room's.`;
  });

  return `\nWhat the whole room answered, and therefore what we built:\n- ${lines.join('\n- ')}`;
}

/**
 * The instructions, assembled from the session's own editable prompt.
 *
 * The caller block is substituted into `{{context}}` where the presenter put it,
 * and appended when they removed the placeholder — an edited prompt that loses
 * the marker must not lose the personalisation with it, since knowing the caller
 * is the whole demo. The tool section and the direction line are always the
 * app's own: both describe mechanics the presenter cannot change by typing.
 */
export function systemPromptFor(
  ctx: CallerContext,
  config: RelayConfig,
  opts: { opening?: boolean } = {}
): string {
  const name = ctx.name || 'someone whose name you do not know';
  // The room's block and the instruction for reading it travel together: the
  // instruction alone is advice about data the agent was not given, and the data
  // alone leaves it guessing what a majority is for.
  const room = config.roomContext ? describeRoom(ctx) : '';
  const outcome = room && config.outcomeInstruction ? `\n\n${config.outcomeInstruction}` : '';
  const context = `You are speaking with ${name}.${describeContext(ctx)}${room}${outcome}`;

  const base = config.systemPrompt.includes('{{context}}')
    ? config.systemPrompt.replace('{{context}}', context)
    : `${config.systemPrompt}\n\n${context}`;

  const direction = ctx.inbound
    ? 'They chose to call in, so let them lead: answer what they ask, ask a follow-up, and stay on the line until they are done.'
    : 'You called them as part of the finale, so wrap up warmly after two or three exchanges.';

  // Only after the opening line. On the opening turn this rule and the greeting
  // instruction contradict each other, and the one that loses decides whether the
  // phone is answered by a greeting or by nothing.
  const mid = opts.opening ? '' : `\n\n${MID_CONVERSATION_RULE}`;

  return `${base}${relayToolPrompt(config)}\n\n${direction}${mid}`;
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
