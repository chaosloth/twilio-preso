import type { FastifyInstance } from 'fastify';
import Twilio from 'twilio';
import { llmConfigFromEnv } from '@twilio-preso/llm';
import type { FeatureReport, FeatureStatus, PhonePoolEntry } from '@twilio-preso/shared';
import { config } from '../config.js';
import { requirePresenter } from '../services/auth.js';
import {
  describeNumberWebhook,
  describePoolUsage,
  getSessionById,
  phoneNumberForSession,
  pointNumberAtVoiceAgent,
  setSessionRelay,
} from '../services/sessions.js';
import { getPresentationState } from '../services/sync.js';
import { probeAmbientSound } from '../services/ambientSound.js';
import type { AmbientSoundStatus } from '../services/ambientSound.js';
import {
  DESIRED_TRAITS,
  ensureTraitGroups,
  probeMemoryStore,
  probeMemoryTraits,
} from '../services/memory.js';
import { probeLlm } from '../services/ai.js';
import { describeContentTemplates, ensureContentTemplates } from '../services/content.js';
import { describeOrchestrator, webhookUrl } from '../services/orchestrator.js';
import { isSignatureBypassed } from '../services/twilioSignature.js';

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

      const [sync, verify, messaging, memory, traits, llmProbe, templates, orchestrator, pool, state, ambient] =
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
        // Reads the account's own 12200 alerts, so an unreachable Monitor API
        // must leave the rest of the report readable like every probe above.
        /**
         * Both directions, because they are two configs now and the loop that
         * gets rejected may be set on only one of them. Reported as whichever has
         * something to say: a problem on either is a problem worth the row.
         */
        Promise.all([
          probeAmbientSound(sessionId, 'inbound').catch(() => null),
          probeAmbientSound(sessionId, 'outbound').catch(() => null),
        ]).then(worseAmbient),
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
      /**
       * What this session's number actually answers an inbound call with. Read
       * here rather than beside the other probes because it needs the claim to
       * have been resolved first, and best-effort like all of them: an
       * unreachable numbers API must leave the rest of the report readable.
       */
      const numberWebhook =
        sessionId && thisSessionNumber
          ? await describeNumberWebhook(thisSessionNumber, sessionId).catch(() => null)
          : null;
      const signatureBypassed = isSignatureBypassed();

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
          /**
           * Whether a *call in* reaches this session's own voice settings.
           *
           * The number's inbound webhook is written once, when the session claims
           * it, and nothing rewrites it afterwards — so a number configured by
           * hand, by an older build, or against another environment keeps
           * answering that way through every redeploy. It fails as almost
           * nothing: the call connects and the caller is greeted by name, because
           * the relay infers the session from the number either way. Only the
           * voice, the language and the ambient sound are the shipped defaults —
           * which on stage reads as "the deploy did not take".
           */
          id: 'voice-webhook',
          label: 'Call-in number webhook',
          state: !sessionId || !thisSessionNumber
            ? 'off'
            : !numberWebhook
              ? 'warn'
              : numberWebhook.matches
                ? 'ok'
                : numberWebhook.reachesThisBackend
                  ? 'warn'
                  : 'error',
          detail: !sessionId
            ? 'No session selected.'
            : !thisSessionNumber
              ? 'No pool number is claimed for this session yet, so there is nothing to call in on.'
              : !numberWebhook
                ? 'Could not read the number’s configuration, so what an inbound call does is unknown.'
                : numberWebhook.matches
                  ? 'Calling in is answered with this session’s own voice, language and prompt.'
                  : numberWebhook.reachesThisBackend
                    ? 'The number reaches this backend but names no session, so the session is inferred from the number. It works — one extra lookup on a ringing phone — and pointing it at this session removes the guess.'
                    : 'The number answers somewhere else entirely — a TwiML Bin, or another environment — so calling in never runs this presentation at all. Its voice and prompt will be whatever that other place says.',
          // A single `incomingPhoneNumbers.update`, idempotent, and scoped to the
          // one number this session already holds — but still a button, because
          // it writes account configuration that outlives the event.
          action:
            sessionId && thisSessionNumber && numberWebhook && !numberWebhook.matches
              ? {
                  label: 'Point this number at this session',
                  path: `/api/voice/number-webhook?sessionId=${encodeURIComponent(sessionId)}`,
                }
              : undefined,
          values: numberWebhook
            ? [
                { label: 'Number', value: numberWebhook.phoneNumber },
                { label: 'Answers with', value: numberWebhook.registered ?? 'nothing configured' },
                { label: 'Should be', value: numberWebhook.expected },
              ]
            : thisSessionNumber
              ? [{ label: 'Number', value: thisSessionNumber }]
              : undefined,
        },
        {
          /**
           * Whether the room tone the voice tab offers actually reaches the call.
           *
           * `agentAmbientSound` is gated on an internal account flag (1267), and
           * an account without it does *not* fail the call: Twilio raises an XML
           * validation warning (12200) per attribute, drops both, and connects
           * dry. So the knob looks like it works, the room hears nothing, and the
           * two warnings pile up beside every real problem the call has — which is
           * how a Connect media timeout came to look like an ambient-sound bug.
           * There is no API for the flag, so this reports the consequence: the
           * account's own recent rejections, counted.
           */
          id: 'ambient-sound',
          label: 'Agent ambient sound',
          state: !ambient
            ? 'warn'
            : !ambient.url
              ? 'off'
              : ambient.rejections > 0 || ambient.fileOk === false
                ? 'error'
                : ambient.fileOk === null
                  ? 'warn'
                  : 'ok',
          detail: !ambient
            ? 'Could not read this account’s alerts, so whether ambience reaches the call is unknown.'
            : !ambient.url
              ? 'No loop set — the agent speaks dry, and neither ambient attribute is sent.'
              : ambient.rejections > 0
                ? `This account rejects ambient sound: ${ambient.rejections} XML validation warning${ambient.rejections === 1 ? '' : 's'} naming agentAmbientSound in the last 24 hours. The calls still connect — Twilio drops both attributes — but nobody hears the loop, and the warnings sit in the log beside every real fault. Needs the ambient-sound flag (1267) on the account; clearing the loop is what stops the noise.`
                : ambient.fileOk === false
                  ? `The account has not rejected the attribute, but the file will: ${ambient.fileDetail}`
                  : ambient.fileOk === null
                    ? `The attribute is being sent and no rejection has been logged, but the file itself could not be checked: ${ambient.fileDetail}`
                    : 'A room tone plays under the agent, and the file is the format ConversationRelay needs.',
          // Clears one field on one session record — the same write the voice tab
          // makes, offered here because the reason to make it is only visible in
          // this report. Nothing account-level is touched; the flag is Twilio's.
          action:
            sessionId && ambient?.url && (ambient.rejections > 0 || ambient.fileOk === false)
              ? {
                  label: 'Turn ambient sound off for this session',
                  path: `/api/voice/ambient-sound/clear?sessionId=${encodeURIComponent(sessionId)}`,
                }
              : undefined,
          values: ambient?.url
            ? [
                { label: 'Direction', value: ambient.direction },
                { label: 'Loop', value: ambient.url },
                { label: 'Gain', value: String(ambient.gain) },
                { label: 'File', value: ambient.fileDetail },
                {
                  label: 'Rejections (24h)',
                  value: ambient.lastRejectedAt
                    ? `${ambient.rejections}, most recently ${ambient.lastRejectedAt}`
                    : String(ambient.rejections),
                },
              ]
            : undefined,
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
                : `The configuration calls back to a different origin, so texts reach nothing here: ${orchestrator.registeredCallback ?? 'none registered'}`,
          // Manual, like the templates above: it writes account-level Twilio
          // configuration that outlives the event. Creation is not idempotent on
          // Twilio's side either, so this matches by display name and updates.
          action:
            config.twilio.memoryStoreId && !orchestrator?.callbackMatches
              ? { label: 'Create & update configuration', path: '/api/orchestrator/configuration' }
              : undefined,
          values: [
            { label: 'Expected callback', value: webhookUrl() },
            { label: 'Registered callback', value: orchestrator?.registeredCallback ?? 'none' },
            ...(orchestrator?.configurationId
              ? [{ label: 'Configuration', value: orchestrator.configurationId }]
              : []),
            // An id that resolved to nothing is the failure that otherwise reads
            // as a missing configuration: the env names one, the account has
            // another, and pressing create would make a third.
            ...(orchestrator?.configuredId && !orchestrator.idMatches
              ? [
                  {
                    label: 'TWILIO_CONVERSATION_ORCHESTRATION_CONFIG_ID',
                    value: `${orchestrator.configuredId} — not found, matched by name instead`,
                  },
                ]
              : orchestrator?.configuredId
                ? [{ label: 'From env', value: orchestrator.configuredId }]
                : []),
          ],
        },
        {
          id: 'orchestrator-signature',
          label: 'Text agent webhook signature',
          state: signatureBypassed ? 'warn' : 'ok',
          detail: signatureBypassed
            ? 'BYPASSED: the webhook accepts unsigned callbacks, so anyone who knows the URL can make this account run an LLM turn and send a message. It closes itself on the next restart or deploy.'
            : 'Every callback is validated against the account auth token and this origin. A mismatch is a 403 in the log and a text that gets no reply.',
          action: {
            label: signatureBypassed ? 'Re-enable validation' : 'Bypass validation (debug)',
            path: '/api/orchestrator/signature-bypass',
          },
          values: [{ label: 'Signed origin', value: config.publicBaseUrl }],
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

  /**
   * Re-points this session's claimed number at this session's voice agent.
   *
   * The same write session creation does, on demand — because that write happens
   * once and a number can drift out from under it afterwards, and the drift is
   * invisible until an inbound call is answered in the wrong voice. Idempotent,
   * and it only ever touches the number this session already holds: the session
   * id comes from the query rather than the body because the HUD's action button
   * POSTs a bare path.
   */
  app.post<{ Querystring: { sessionId?: string } }>(
    '/api/voice/number-webhook',
    { preHandler: requirePresenter },
    async (request, reply) => {
      const sessionId = request.query.sessionId;
      if (!sessionId) return reply.status(400).send({ error: 'sessionId is required' });
      const phoneNumber = await phoneNumberForSession(sessionId);
      if (!phoneNumber) {
        return reply.status(409).send({ error: 'This session holds no pool number to point.' });
      }
      try {
        await pointNumberAtVoiceAgent(phoneNumber, sessionId);
        // Read it back rather than reporting the write: the write is best-effort
        // by design (a number this account cannot reconfigure must not fail a
        // session), so "done" is not the same thing as "pointed".
        return await describeNumberWebhook(phoneNumber, sessionId);
      } catch (err: any) {
        request.log.error({ err }, 'failed to point number at the voice agent');
        return reply.status(502).send({ error: err?.message ?? 'could not update the number' });
      }
    }
  );

  /**
   * Turns ambient sound off for one session.
   *
   * The voice tab can do this too; it is here because the *reason* to do it —
   * that this account rejects the attribute on every call — is only visible in
   * this report. It clears the loop rather than the gain: a gain on its own is a
   * volume for silence, and `relayTwiml` omits both attributes together.
   */
  app.post<{ Querystring: { sessionId?: string } }>(
    '/api/voice/ambient-sound/clear',
    { preHandler: requirePresenter },
    async (request, reply) => {
      const sessionId = request.query.sessionId;
      if (!sessionId) return reply.status(400).send({ error: 'sessionId is required' });
      const session = await getSessionById(sessionId);
      if (!session) return reply.status(404).send({ error: 'session not found' });
      /**
       * Both directions, since the noise is per account and a presenter pressing
       * this wants the calls quiet — not the inbound ones quiet and the finale
       * still raising warnings. A partial is stored, so the rest of each config's
       * voice settings are carried through field by field rather than reset.
       */
      await setSessionRelay(sessionId, { ...(session.relay ?? {}), ambientSound: '' }, 'inbound');
      const updated = session.relayOutbound
        ? await setSessionRelay(
            sessionId,
            { ...session.relayOutbound, ambientSound: '' },
            'outbound'
          )
        : await getSessionById(sessionId);
      return { cleared: true, ambientSound: updated?.relay?.ambientSound ?? '' };
    }
  );

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

/**
 * Which of the two directions' ambient settings the HUD should report.
 *
 * The one with an actual fault first, then the one with a loop set at all — a row
 * saying "no file set" for outbound while inbound is being rejected is the one
 * shape of this report that would mislead.
 */
function worseAmbient(
  probes: Array<AmbientSoundStatus | null>
): AmbientSoundStatus | null {
  const present = probes.filter((p): p is AmbientSoundStatus => p !== null);
  return (
    present.find((p) => p.url && (p.rejections > 0 || p.fileOk !== true)) ??
    present.find((p) => p.url) ??
    present[0] ??
    null
  );
}
