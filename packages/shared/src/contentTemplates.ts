/**
 * The WhatsApp side of every message this talk sends, as Content API templates.
 *
 * WhatsApp will not deliver free-form text to someone outside a 24-hour customer
 * service window, so every outbound message the presenter fires has to be an
 * *approved* template — created once with the Content API, submitted to Meta for
 * approval, then sent by `ContentSid` with the per-recipient values supplied as
 * `ContentVariables`.
 *
 * The bodies live here, in shared, for one reason: the SMS half of each trigger
 * renders **from the same template** (`renderTemplate`). An approved WhatsApp
 * body cannot be edited on the fly, so copy written separately for SMS drifts —
 * and only the WhatsApp half is the version anybody reviewed.
 *
 * Variables are positional and 1-based, matching the Content API's own shape:
 * `{{1}}` in the body, `{"1": "Billy"}` in the payload.
 */
export interface ContentTemplate {
  /** Stable key. Also the template's `friendly_name` prefix, which is how a
   *  previously-created template is found again rather than duplicated. */
  key: string;
  /**
   * WhatsApp template category. `UTILITY` for a message that follows from
   * something the recipient did — which is every message here: they registered.
   * `MARKETING` invites stricter review and per-user opt-out limits.
   */
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  /** BCP-47-ish language the body is written in, as the Content API wants it. */
  language: string;
  /** The approved text, with `{{n}}` placeholders. */
  body: string;
  /** Example value per variable — required at creation: Meta reviews the body
   *  with the examples substituted in, and a missing one fails the submission. */
  variables: Record<string, string>;
}

function template(t: ContentTemplate): ContentTemplate {
  return t;
}

export const CONTENT_TEMPLATES: Record<string, ContentTemplate> = {
  welcome: template({
    key: 'welcome',
    category: 'UTILITY',
    language: 'en',
    body: "Welcome to Wonder, {{1}}! You're in. Keep this chat open — the demo will reach you here. — Wonder by Twilio",
    variables: { '1': 'Billy' },
  }),
  patience: template({
    key: 'patience',
    category: 'UTILITY',
    language: 'en',
    body: "You've been on hold for 7 minutes. Still waiting...\n\nThis is what your customers feel every day. — Wonder by Twilio",
    variables: {},
  }),
  orchestrator: template({
    key: 'orchestrator',
    category: 'UTILITY',
    language: 'en',
    body: 'Hey {{1}}, following up from our earlier message. Notice how this conversation continued seamlessly across channels? That’s Conversation Orchestrator. — Twilio',
    variables: { '1': 'Billy' },
  }),
  /** What Conversation Memory recalled — a whole sentence, so it gets its own
   *  line rather than being quoted inside one. */
  'memory-recall': template({
    key: 'memory-recall',
    category: 'UTILITY',
    language: 'en',
    body: "Hey {{1}}, here's what we remember about you: {{2}}\n\nNo database lookup, no asking again. That's Conversation Memory. — Twilio",
    variables: { '1': 'Billy', '2': 'they want to build a voice agent for support' },
  }),
  /** The fallback: this session's own word-cloud answer, which is a phrase and is
   *  quoted as one. A separate template because an approved body is fixed text —
   *  one body cannot be both shapes. */
  'memory-answer': template({
    key: 'memory-answer',
    category: 'UTILITY',
    language: 'en',
    body: 'Hey {{1}}, you said "{{2}}" was your biggest challenge. We remembered — no database lookup, no asking again. That’s Conversation Memory. — Twilio',
    variables: { '1': 'Billy', '2': 'long hold times' },
  }),
  closing: template({
    key: 'closing',
    category: 'UTILITY',
    language: 'en',
    body: 'Thanks for joining us, {{1}}! Want to explore the demo yourself? Check it out here: https://www.twilio.com/en-us/solutions/agent-productivity\n\nletsGoMichelangeloMode(); — Wonder by Twilio',
    variables: { '1': 'Billy' },
  }),
};

export type ContentTemplateKey = keyof typeof CONTENT_TEMPLATES;

/** The Content API's `ContentVariables` shape: positional, 1-based, string keys. */
export function contentVariables(values: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  values.forEach((value, i) => {
    out[String(i + 1)] = value;
  });
  return out;
}

/**
 * The template as plain text — what the SMS carries, and what the WhatsApp
 * fallback sends when a template is unapproved or a send fails.
 *
 * A placeholder with no value is left in place rather than blanked: a message
 * reading "Hey , you said" is a bug that reaches a real phone silently, while a
 * visible `{{1}}` is one a rehearsal catches.
 */
export function renderTemplate(key: string, values: readonly string[]): string {
  const found = CONTENT_TEMPLATES[key];
  if (!found) return '';
  const vars = contentVariables(values);
  return found.body.replace(/\{\{(\d+)\}\}/g, (match, n: string) => vars[n] ?? match);
}
