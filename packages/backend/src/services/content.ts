import { CONTENT_TEMPLATES, contentVariables } from '@twilio-preso/shared';
import type { ContentTemplate } from '@twilio-preso/shared';
import { config } from '../config.js';

/**
 * Twilio Content API — the approved templates the WhatsApp half of this talk
 * sends.
 *
 * WhatsApp only delivers free-form text inside a 24-hour customer service
 * window, which an attendee who has never messaged the sender is outside by
 * definition. So every outbound WhatsApp message is a template: created once,
 * submitted to Meta for approval, then sent by `ContentSid` with per-recipient
 * `ContentVariables`.
 *
 * Three things about this API are worth stating, because each fails in a way that
 * looks like something else:
 *
 * - **Approval is asynchronous and can be rejected.** A template exists the
 *   moment it is created and still cannot be sent for minutes or hours. So
 *   `approvedContentSid` returns a sid *only* once WhatsApp says approved, and
 *   every caller keeps its plain-text body as the fallback — an unapproved
 *   template must degrade to SMS, not to nothing.
 * - **Creation is not idempotent.** Posting the same `friendly_name` twice makes
 *   two templates, and the second one starts unapproved. Existing content is
 *   listed and matched by name first, which is what makes "declare templates" a
 *   button a presenter can press twice.
 * - **`ContentVariables` is a JSON-encoded *string*,** not an object, on the
 *   Messages API.
 *
 * `content.twilio.com` has no Node SDK surface for approval submission, so this
 * is a small basic-auth fetch client like `memory.ts`.
 */

const BASE = 'https://content.twilio.com/v1';

/** Meta requires lowercase alphanumerics and underscores. The prefix keeps this
 *  app's templates distinguishable in an account shared with other demos. */
export function friendlyNameFor(key: string): string {
  return `wonder_${key.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
}

export type ApprovalStatus = 'approved' | 'pending' | 'rejected' | 'unsubmitted' | 'unknown';

export interface TemplateState {
  key: string;
  friendlyName: string;
  contentSid?: string;
  status: ApprovalStatus;
  /** Meta's reason when it rejected, so the HUD can say why. */
  rejectionReason?: string;
}

function authHeader(): string {
  const { accountSid, authToken } = config.twilio;
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
}

async function contentFetch<T>(path: string, body?: unknown, method = 'GET'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`content ${method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

interface ContentListResponse {
  contents?: Array<{ sid?: string; friendly_name?: string }>;
  meta?: { next_page_url?: string | null };
}

interface ApprovalResponse {
  whatsapp?: { status?: string; rejection_reason?: string; name?: string };
}

/**
 * Every template this account already holds, by friendly name.
 *
 * Paged through rather than read one page deep: an account that has run a few
 * demos has more than fifty templates, and a template that exists but is not
 * *seen* is the one that gets created a second time.
 */
async function listContentSids(): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  let path: string | null = '/Content?PageSize=100';
  while (path) {
    const page: ContentListResponse = await contentFetch<ContentListResponse>(path);
    for (const item of page.contents ?? []) {
      if (item.friendly_name && item.sid && !byName.has(item.friendly_name)) {
        byName.set(item.friendly_name, item.sid);
      }
    }
    const next = page.meta?.next_page_url ?? null;
    path = next ? next.replace(BASE, '') : null;
  }
  return byName;
}

async function approvalStatus(contentSid: string): Promise<{ status: ApprovalStatus; reason?: string }> {
  try {
    const result = await contentFetch<ApprovalResponse>(`/Content/${contentSid}/ApprovalRequests`);
    const raw = result?.whatsapp?.status?.toLowerCase();
    if (!raw) return { status: 'unsubmitted' };
    if (raw === 'approved') return { status: 'approved' };
    if (raw === 'rejected') {
      return { status: 'rejected', reason: result?.whatsapp?.rejection_reason };
    }
    // Twilio reports `received` and `pending` while Meta is still reviewing.
    return { status: 'pending' };
  } catch {
    // A template with no approval request at all answers 404 here, which is the
    // normal state of a just-created one — not an error worth surfacing.
    return { status: 'unsubmitted' };
  }
}

async function createContent(template: ContentTemplate): Promise<string> {
  const created = await contentFetch<{ sid?: string }>(
    '/Content',
    {
      friendly_name: friendlyNameFor(template.key),
      language: template.language,
      variables: template.variables,
      types: { 'twilio/text': { body: template.body } },
    },
    'POST'
  );
  if (!created?.sid) throw new Error(`Content create for ${template.key} returned no sid`);
  return created.sid;
}

async function submitForApproval(template: ContentTemplate, contentSid: string): Promise<void> {
  await contentFetch(
    `/Content/${contentSid}/ApprovalRequests/whatsapp`,
    { name: friendlyNameFor(template.key), category: template.category },
    'POST'
  );
}

/**
 * Cached template state, refreshed by `describeContentTemplates`.
 *
 * A send cannot afford two HTTP round trips per recipient — the finale messages a
 * whole room at once — and approval state changes on Meta's timescale, not the
 * talk's. Empty until something reads it, which is why every caller has a
 * plain-text fallback rather than depending on this being warm.
 */
let cache: Map<string, TemplateState> = new Map();
let readAt = 0;
/** Shared by every concurrent caller, so a finale messaging the whole room reads
 *  the account once rather than once per recipient. */
let inFlight: Promise<void> | null = null;

/**
 * How long a read is trusted. Short enough that a template approved *during* the
 * talk becomes usable without a redeploy or a HUD press, long enough that a
 * room's worth of sends is one listing.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** The sid to send by, or null — meaning "send plain text instead". Never blocks:
 *  a cold cache is a text message, not a wait. */
export function approvedContentSid(key: string): string | null {
  const state = cache.get(key);
  return state?.status === 'approved' && state.contentSid ? state.contentSid : null;
}

/**
 * The sid to send by, reading the account first when what we hold is cold or
 * stale.
 *
 * This exists because the synchronous version above was the whole WhatsApp path,
 * and nothing filled the cache at boot: a freshly deployed backend sent every
 * WhatsApp trigger as free-form text, which WhatsApp drops outside the 24-hour
 * window, so an approved template sat unused and the room silently dropped to
 * SMS. It only appeared to work because opening the HUD's Config tab warmed it.
 *
 * A failed read resolves to null rather than throwing: the message still has to
 * go out, and plain text then SMS is what a missing template has always meant.
 */
export async function contentSidFor(key: string): Promise<string | null> {
  if (!cache.size || Date.now() - readAt > CACHE_TTL_MS) {
    inFlight ??= describeContentTemplates()
      .then(() => undefined)
      .catch((err) => {
        console.warn('Content templates could not be read — sending plain text:', err);
      })
      .finally(() => {
        inFlight = null;
      });
    await inFlight;
  }
  return approvedContentSid(key);
}

/** Test seam. Nothing in the running app clears this — the TTL is what keeps it
 *  honest there. */
export function resetContentCache(): void {
  cache = new Map();
  readAt = 0;
  inFlight = null;
}

export function contentVariablesJson(values: readonly string[]): string {
  return JSON.stringify(contentVariables(values));
}

/** Every template's real state, read from Twilio and cached. What the HUD shows. */
export async function describeContentTemplates(): Promise<TemplateState[]> {
  const existing = await listContentSids();
  const states = await Promise.all(
    Object.values(CONTENT_TEMPLATES).map(async (template): Promise<TemplateState> => {
      const friendlyName = friendlyNameFor(template.key);
      const contentSid = existing.get(friendlyName);
      if (!contentSid) return { key: template.key, friendlyName, status: 'unsubmitted' };
      const { status, reason } = await approvalStatus(contentSid);
      return { key: template.key, friendlyName, contentSid, status, rejectionReason: reason };
    })
  );
  cache = new Map(states.map((s) => [s.key, s]));
  readAt = Date.now();
  return states;
}

/**
 * Creates whatever is missing and submits whatever is unsubmitted, then reports.
 *
 * Deliberately a button rather than something boot does: it writes templates into
 * the Twilio account and asks Meta to review them, which outlives the event — the
 * same reason declaring memory trait groups is manual. Safe to press twice; an
 * existing template is matched by name and left alone.
 */
export async function ensureContentTemplates(): Promise<TemplateState[]> {
  const existing = await listContentSids();

  for (const template of Object.values(CONTENT_TEMPLATES)) {
    const friendlyName = friendlyNameFor(template.key);
    try {
      const contentSid = existing.get(friendlyName) ?? (await createContent(template));
      const { status } = await approvalStatus(contentSid);
      // Only an unsubmitted template is submitted. Re-submitting a pending one is
      // how a template ends up queued twice; a rejected one needs its body
      // changed, which is a code change, not a retry.
      if (status === 'unsubmitted') await submitForApproval(template, contentSid);
    } catch (err) {
      // One template failing must not stop the rest: the others are still worth
      // having, and the returned state says which one did not make it.
      console.warn(`Content template ${template.key} could not be prepared:`, err);
    }
  }

  return describeContentTemplates();
}
