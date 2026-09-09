import type { FastifyInstance } from 'fastify';
import Twilio from 'twilio';
import { llmConfigFromEnv } from '@twilio-preso/llm';
import type { FeatureReport, FeatureStatus, PhonePoolEntry } from '@twilio-preso/shared';
import { config } from '../config.js';
import { requirePresenter } from '../services/auth.js';
import { describePoolUsage } from '../services/sessions.js';
import { getPresentationState } from '../services/sync.js';
import {
  DESIRED_TRAITS,
  ensureTraitGroups,
  probeMemoryStore,
  probeMemoryTraits,
} from '../services/memory.js';
import { probeLlm } from '../services/ai.js';
import { describeContentTemplates, ensureContentTemplates } from '../services/content.js';
import { describeOrchestrator } from '../services/orchestrator.js';

const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

/** Every probe is independent and best-effort: one unreachable service must
 *  still leave the rest of the report readable. */
async function probe(fn: () => Promise<string>): Promise<{ ok: boolean; detail: string }> {
  try {
    return { ok: true, detail: await fn() };
  } catch (err: any) {
    return { ok: false, detail: err?.message ?? 'unreachable' };
  }
}

export async function featureRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Presenter-only: it names sids, phone numbers and the rehearsal gate.
   * `sessionId` is optional — the report is mostly account-wide, and a presenter
   * still choosing a session should be able to see whether the account is sound.
   * Not behind `requireLiveSession` for the same reason.
   */
  app.get<{ Querystring: { sessionId?: string } }>(
    '/api/features',
    { preHandler: requirePresenter },
    async (request) => {
      const sessionId = request.query.sessionId;

      const [sync, verify, messaging, memory, traits, llmProbe, templates, orchestrator, pool, state] =
        await Promise.all([
        probe(async () => {
          const s = await client.sync.v1.services(config.twilio.syncServiceSid).fetch();
          return s.friendlyName || s.sid;
        }),
        probe(async () => {
          const s = await client.verify.v2.services(config.twilio.verifyServiceSid).fetch();
          return s.friendlyName || s.sid;
        }),
        probe(async () => {
          const s = await client.messaging.v1.services(config.twilio.messagingServiceSid).fetch();
          return s.friendlyName || s.sid;
        }),
        probeMemoryStore(),
        probeMemoryTraits(),
        probeLlm(),
        // Best-effort like every other probe: an unreachable Content API must
        // leave the rest of the report readable, and no templates simply means
        // every WhatsApp send is plain text inside the 24-hour window.
        describeContentTemplates().catch(() => []),
        // Same shape of best-effort as the templates probe: an unreachable
        // Orchestrator must leave the rest of the report readable, and no
        // configuration simply means texting the number gets no reply.
        describeOrchestrator().catch(() => null),
        describePoolUsage().catch(() => []),
        sessionId ? getPresentationState(sessionId).catch(() => null) : Promise.resolve(null),
      ]);

      const claimed = new Map(pool.map((p) => [p.phoneNumber, p]));
      const phonePool: PhonePoolEntry[] = config.twilio.phonePool.map((phoneNumber) => {
        const claim = claimed.get(phoneNumber);
        return {
          phoneNumber,
          sessionId: claim?.sessionId,
          sessionTitle: claim?.sessionTitle,
          joinCode: claim?.joinCode,
          isThisSession: !!sessionId && claim?.sessionId === sessionId,
        };
      });
      // A claim on a number that is no longer in the pool is still using it, so
      // show it rather than hiding a live session behind an edited env var.
      for (const claim of pool) {
        if (!config.twilio.phonePool.includes(claim.phoneNumber)) {
          phonePool.push({ ...claim, isThisSession: claim.sessionId === sessionId });
        }
      }

      const thisSessionNumber = phonePool.find((p) => p.isThisSession)?.phoneNumber;
      const relayUrl = process.env.CONVERSATION_RELAY_URL || '';

      let llm: FeatureStatus;
      try {
        const cfg = llmConfigFromEnv(process.env);
        // The probe, not the env, decides `ok`. Valid config with a dead key or
        // an empty credit balance is the exact failure that looks like a bug in
        // the app: the question reaches the big screen and no answer follows.
        llm = {
          id: 'llm',
          label: 'AI prompt agent',
          state: llmProbe.ok ? 'ok' : 'error',
          detail: llmProbe.ok
            ? 'The on-screen agent and voice agent can answer.'
            : `Configured but the provider refused the call — every "Ask the agent" will fail: ${llmProbe.detail}`,
          values: [
            { label: 'Provider', value: cfg.provider },
            { label: 'Model', value: cfg.model },
          ],
        };
      } catch (err: any) {
        llm = {
          id: 'llm',
          label: 'AI prompt agent',
          state: 'error',
          detail: err?.message ?? 'LLM_* env vars are invalid',
        };
      }

      const features: FeatureStatus[] = [
        {
          id: 'sync',
          label: 'Twilio Sync (state bus)',
          state: sync.ok ? 'ok' : 'error',
          detail: sync.ok
            ? 'Presenter, phones and backend share state.'
            : `Nothing will follow the presenter: ${sync.detail}`,
          values: [
            { label: 'Service', value: config.twilio.syncServiceSid },
            ...(sync.ok ? [{ label: 'Name', value: sync.detail }] : []),
          ],
        },
        {
          id: 'live',
          label: 'Outbound armed (isLive)',
          state: !sessionId ? 'off' : state?.isLive ? 'ok' : 'warn',
          detail: !sessionId
            ? 'No session selected.'
            : state?.isLive
              ? 'Real SMS and calls WILL be sent to every registered phone.'
              : 'Rehearsal: triggers are accepted but nothing leaves Twilio.',
        },
        {
          id: 'sms',
          label: 'SMS',
          state: thisSessionNumber ? 'ok' : messaging.ok ? 'warn' : 'error',
          detail: thisSessionNumber
            ? 'Texts go out from this session’s own claimed number.'
            : messaging.ok
              ? 'No pool number is claimed for this session yet.'
              : `Messaging service unreachable: ${messaging.detail}`,
          values: [
            ...(thisSessionNumber ? [{ label: 'From', value: thisSessionNumber }] : []),
            { label: 'Messaging service', value: config.twilio.messagingServiceSid },
          ],
        },
        {
          id: 'whatsapp',
          label: 'WhatsApp',
          state: config.twilio.whatsappFrom ? 'ok' : 'off',
          detail: config.twilio.whatsappFrom
            ? 'whatsapp- triggers send over WhatsApp, per recipient, and fall back to SMS when it cannot deliver — an unregistered number, or a closed 24-hour window.'
            : 'TWILIO_WHATSAPP_FROM unset — whatsapp- triggers send as SMS instead. The message still arrives; it just is not the channel being demonstrated.',
          values: config.twilio.whatsappFrom
            ? [{ label: 'Sender', value: config.twilio.whatsappFrom }]
            : undefined,
        },
        {
          id: 'voice',
          label: 'Voice agent (ConversationRelay)',
          state: relayUrl ? 'ok' : 'off',
          detail: relayUrl
            ? 'Calls are answered by the live voice agent.'
            : 'CONVERSATION_RELAY_URL unset — calls fall back to the static TwiML bot.',
          values: [
            ...(relayUrl
              ? [
                  { label: 'Relay', value: relayUrl },
                  { label: 'TwiML', value: `${config.publicBaseUrl}/api/voice/conversation-relay` },
                ]
              : [{ label: 'TwiML', value: `${config.publicBaseUrl}/api/voice/demo-bot` }]),
            // The claim points this number's inbound webhook at the agent, so it
            // is a number an attendee can actually ring — worth reading out.
            ...(thisSessionNumber ? [{ label: 'Call in on', value: thisSessionNumber }] : []),
          ],
        },
        {
          id: 'memory',
          label: 'Conversation Memory',
          state: !config.twilio.memoryStoreId ? 'off' : memory.ok ? 'ok' : 'error',
          detail: !config.twilio.memoryStoreId
            ? 'TWILIO_MEMORY_STORE_ID unset — personalization falls back to this session’s answers.'
            : memory.ok
              ? 'Attendees get a durable Customer Profile that outlives the event.'
              : `Store configured but unreachable: ${memory.detail}`,
          values: config.twilio.memoryStoreId
            ? [{ label: 'Store', value: config.twilio.memoryStoreId }]
            : undefined,
        },
        {
          id: 'memory-traits',
          label: 'Memory trait schema',
          state: !config.twilio.memoryStoreId ? 'off' : traits.ok ? 'ok' : 'warn',
          detail: !config.twilio.memoryStoreId
            ? 'No store, so no schema to declare.'
            : traits.ok
              ? 'Registration’s company and role are stored as traits, not just prose.'
              : `Undeclared traits are dropped from every profile write — the demo still runs, just thinner: ${traits.detail}`,
          // Idempotent and additive (create the group, PATCH the missing
          // traits), so it is safe to press twice; still a button rather than
          // automatic, because it edits the account's schema.
          action: traits.ok || !config.twilio.memoryStoreId
            ? undefined
            : { label: 'Declare missing traits', path: '/api/memory/traits' },
          values: Object.entries(DESIRED_TRAITS).map(([group, defs]) => ({
            label: group,
            value: Object.keys(defs).join(', '),
          })),
        },
        llm,
        {
          id: 'verify',
          label: 'Phone verification',
          state: config.dev.bypassVerify ? 'warn' : verify.ok ? 'ok' : 'error',
          detail: config.dev.bypassVerify
            ? `DEV_BYPASS_VERIFY is on: no OTP is sent and code ${config.dev.bypassCode} is accepted for presenter sign-in.`
            : verify.ok
              ? 'Presenter sign-in sends a real OTP.'
              : `Verify service unreachable: ${verify.detail}`,
          values: [{ label: 'Service', value: config.twilio.verifyServiceSid }],
        },
        {
          id: 'whatsapp-templates',
          label: 'WhatsApp content templates',
          state: !config.twilio.whatsappFrom
            ? 'off'
            : templates.every((t) => t.status === 'approved')
              ? 'ok'
              : 'warn',
          detail: !config.twilio.whatsappFrom
            ? 'TWILIO_WHATSAPP_FROM unset — every trigger sends SMS, so no template is needed.'
            : templates.every((t) => t.status === 'approved')
              ? 'Every trigger can reach a phone that has never opened the chat.'
              : templates.length === 0
                ? 'No templates created yet. Without one, a WhatsApp send only lands inside the 24-hour window and otherwise falls back to SMS.'
                : 'Some templates are not approved yet. Those triggers still send — as plain text inside the window, SMS outside it.',
          // Creation is not idempotent on Twilio's side, so this creates only
          // what is missing (matched by friendly name) and submits only what has
          // never been submitted. Approval itself is Meta's, and takes minutes
          // to hours — the status below is what to watch.
          action:
            config.twilio.whatsappFrom && !templates.every((t) => t.status === 'approved')
              ? { label: 'Create & submit templates', path: '/api/content/templates' }
              : undefined,
          values: templates.map((t) => ({
            label: t.key,
            value: t.rejectionReason ? `${t.status} — ${t.rejectionReason}` : t.status,
          })),
        },
        {
          id: 'orchestrator',
          label: 'Text agent (Conversation Orchestrator)',
          state: !config.twilio.memoryStoreId
            ? 'off'
            : !orchestrator?.configured
              ? 'warn'
              : orchestrator.callbackMatches
                ? 'ok'
                : 'warn',
          detail: !config.twilio.memoryStoreId
            ? 'TWILIO_MEMORY_STORE_ID unset — an Orchestrator configuration needs a memory store.'
            : !orchestrator?.configured
              ? 'No configuration yet. Create it and an attendee texting the session number reaches the same agent the phone call does.'
              : orchestrator.callbackMatches
                ? 'A text to the session number is answered by this backend, with this session\'s persona.'
                : `The account calls back to a different origin, so texts reach nothing here: ${orchestrator.registeredCallback ?? 'none registered'}`,
          // Manual, like the templates above: it writes account-level Twilio
          // configuration that outlives the event. Creation is not idempotent on
          // Twilio's side either, so this matches by display name and updates.
          action:
            config.twilio.memoryStoreId && !orchestrator?.callbackMatches
              ? { label: 'Create & update configuration', path: '/api/orchestrator/configuration' }
              : undefined,
          values: [
            { label: 'Callback', value: orchestrator?.registeredCallback ?? 'none' },
            ...(orchestrator?.configurationId
              ? [{ label: 'Configuration', value: orchestrator.configurationId }]
              : []),
          ],
        },
        {
          id: 'webhooks',
          label: 'Webhook signatures',
          state: process.env.PUBLIC_BASE_URL ? 'ok' : 'warn',
          detail: process.env.PUBLIC_BASE_URL
            ? 'Twilio voice webhooks validate against this origin.'
            : 'PUBLIC_BASE_URL unset — behind a proxy, signature checks will reject real webhooks.',
          values: [{ label: 'Public base URL', value: config.publicBaseUrl }],
        },
      ];

      const report: FeatureReport = { features, phonePool, generatedAt: Date.now() };
      return report;
    }
  );

  /**
   * Declares the trait groups this app writes. Presenter-only and deliberately
   * manual — it changes the account's memory schema, which outlives the event.
   */
  /**
   * Creates any missing content template and submits it to Meta for approval.
   *
   * Safe to press twice — a template is matched by friendly name rather than
   * created again, since Content API creation is not idempotent and two
   * identical templates is the failure that leaves you guessing which sid the
   * triggers use. Only an unsubmitted template is submitted, so a pending or
   * rejected one is not resubmitted underneath Meta's review.
   */
  app.post('/api/content/templates', { preHandler: requirePresenter }, async (request, reply) => {
    try {
      return { templates: await ensureContentTemplates() };
    } catch (err: any) {
      request.log.error({ err }, 'failed to create content templates');
      return reply.status(502).send({ error: err?.message ?? 'template creation failed' });
    }
  });

  app.post('/api/memory/traits', { preHandler: requirePresenter }, async (request, reply) => {
    if (!config.twilio.memoryStoreId) {
      return reply.status(409).send({ error: 'memory store not configured' });
    }
    try {
      return await ensureTraitGroups();
    } catch (err: any) {
      request.log.error({ err }, 'failed to declare memory traits');
      return reply.status(502).send({ error: err?.message ?? 'trait declaration failed' });
    }
  });
}
