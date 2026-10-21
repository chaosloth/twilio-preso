/**
 * Where `handoff_to_human` sends a caller, and what travels with them.
 *
 * The relay ends its session with a `handoffData` string; Twilio posts that to
 * the `<Connect action>` URL, and the backend answers with the TwiML that reaches
 * the destination. The shape is defined once, here, because two processes write
 * and read it and the only thing between them is a JSON string inside a form
 * field.
 */

/**
 * - `phone` — `<Dial>` a number. The shipped behaviour, and the fallback for the
 *   other two when their target is not set.
 * - `twiml-url` — `<Redirect>` to an HTTP endpoint that serves TwiML: a TwiML
 *   Bin, a Studio flow's webhook, a contact-centre IVR.
 * - `application` — `<Dial><Application>` to a TwiML App, which may live in
 *   another account, with the call's context passed as `<Parameter>`s.
 */
export const HANDOFF_MODES = ['phone', 'twiml-url', 'application'] as const;
export type HandoffMode = (typeof HANDOFF_MODES)[number];

/** A TwiML Application sid. Anything else in `<ApplicationSid>` fails the dial. */
export const APPLICATION_SID = /^AP[0-9a-fA-F]{32}$/;

/**
 * Long enough for a few sentences, short enough to be safe as a `<Parameter>`
 * value and a query-string value — the summary rides in both.
 */
export const HANDOFF_SUMMARY_MAX = 500;

export interface HandoffData {
  /** Why the relay ended: `handoff_to_human`, `end_call`, … */
  reason: string;
  /** An AI summary of the conversation so far, for whoever picks up. */
  summary?: string;
  /** The caller's Conversation Memory profile id, when one is known. */
  profileId?: string;
  /** The attendee's number — the far end of the call, whichever direction. */
  callerPhone?: string;
}

/**
 * Reads `HandoffData` out of the form field Twilio posted.
 *
 * Copied field by field, like every other record that crosses a process
 * boundary here: it is outside data by the time it arrives, and a malformed
 * string must read as "no handoff" rather than throw inside a live call's
 * webhook.
 */
export function parseHandoffData(raw: unknown): HandoffData | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.reason !== 'string') return null;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const data: HandoffData = { reason: obj.reason };
  const summary = str(obj.summary);
  if (summary) data.summary = summary.slice(0, HANDOFF_SUMMARY_MAX);
  const profileId = str(obj.profileId);
  if (profileId) data.profileId = profileId;
  const callerPhone = str(obj.callerPhone);
  if (callerPhone) data.callerPhone = callerPhone;
  return data;
}
