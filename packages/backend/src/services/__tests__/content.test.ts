import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_TEMPLATES } from '@twilio-preso/shared';
import {
  approvedContentSid,
  contentVariablesJson,
  describeContentTemplates,
  ensureContentTemplates,
  friendlyNameFor,
} from '../content.js';

interface Call {
  method: string;
  path: string;
  body: any;
}

/** The account's existing templates, keyed by friendly name, plus each one's
 *  WhatsApp approval status — the two things every decision here turns on. */
function stubContent(existing: Record<string, { sid: string; status?: string }>): Call[] {
  const calls: Call[] = [];
  let created = 0;
  vi.stubGlobal('fetch', async (url: string, init: any = {}) => {
    const method = init.method ?? 'GET';
    const path = url.replace('https://content.twilio.com/v1', '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });

    if (method === 'GET' && path.startsWith('/Content?')) {
      return json({
        contents: Object.entries(existing).map(([friendly_name, v]) => ({
          friendly_name,
          sid: v.sid,
        })),
        meta: { next_page_url: null },
      });
    }
    const approval = path.match(/^\/Content\/(\w+)\/ApprovalRequests$/);
    if (method === 'GET' && approval) {
      const found = Object.values(existing).find((v) => v.sid === approval[1]);
      if (!found?.status) return new Response('', { status: 404 });
      return json({ whatsapp: { status: found.status } });
    }
    if (method === 'POST' && path === '/Content') {
      const sid = `HX${++created}`;
      existing[body.friendly_name] = { sid };
      return json({ sid });
    }
    if (method === 'POST' && path.endsWith('/ApprovalRequests/whatsapp')) {
      return json({ whatsapp: { status: 'received' } });
    }
    return json({});
  });
  return calls;
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('content templates', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('creates only the templates the account is missing', async () => {
    const welcome = friendlyNameFor('welcome');
    const calls = stubContent({ [welcome]: { sid: 'HXwelcome', status: 'approved' } });

    await ensureContentTemplates();

    const created = calls.filter((c) => c.method === 'POST' && c.path === '/Content');
    expect(created.map((c) => c.body.friendly_name)).not.toContain(welcome);
    expect(created).toHaveLength(Object.keys(CONTENT_TEMPLATES).length - 1);
  });

  it('does not resubmit a template Meta is still reviewing', async () => {
    const calls = stubContent(
      Object.fromEntries(
        Object.keys(CONTENT_TEMPLATES).map((key, i) => [
          friendlyNameFor(key),
          { sid: `HX${i}`, status: 'pending' },
        ])
      )
    );

    await ensureContentTemplates();

    expect(calls.filter((c) => c.path.endsWith('/ApprovalRequests/whatsapp'))).toHaveLength(0);
  });

  it('offers a sid only for an approved template', async () => {
    stubContent({
      [friendlyNameFor('welcome')]: { sid: 'HXok', status: 'approved' },
      [friendlyNameFor('closing')]: { sid: 'HXno', status: 'pending' },
    });

    await describeContentTemplates();

    expect(approvedContentSid('welcome')).toBe('HXok');
    // Pending must degrade to plain text, not to an unsendable sid.
    expect(approvedContentSid('closing')).toBeNull();
  });

  it('encodes ContentVariables as a JSON string, 1-based', () => {
    expect(contentVariablesJson(['Ada', 'latency'])).toBe('{"1":"Ada","2":"latency"}');
  });
});
