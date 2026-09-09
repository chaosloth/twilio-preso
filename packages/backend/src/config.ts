function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/** Comma-separated env var → trimmed, de-duplicated, empties dropped. */
function envList(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return [...new Set(raw.split(',').map((v) => v.trim()).filter(Boolean))];
}

/** Twilio addresses WhatsApp endpoints as `whatsapp:+…`; the prefix is added
 *  here so nothing downstream has to remember which form it holds. */
function normalizeWhatsAppSender(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  /**
   * The externally-reachable origin, as Twilio sees it. Used to rebuild the URL
   * a webhook signature was computed over — behind Fly's proxy the request
   * itself reports http, so deriving this from the request would reject every
   * legitimate webhook.
   */
  publicBaseUrl:
    process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || '3001'}`,
  twilio: {
    accountSid: requireEnv('TWILIO_ACCOUNT_SID'),
    authToken: requireEnv('TWILIO_AUTH_TOKEN'),
    apiKeySid: requireEnv('TWILIO_API_KEY_SID'),
    apiKeySecret: requireEnv('TWILIO_API_KEY_SECRET'),
    syncServiceSid: requireEnv('TWILIO_SYNC_SERVICE_SID'),
    verifyServiceSid: requireEnv('TWILIO_VERIFY_SERVICE_SID'),
    messagingServiceSid: requireEnv('TWILIO_MESSAGING_SERVICE_SID'),
    phoneNumber: requireEnv('TWILIO_PHONE_NUMBER'),
    /**
     * Numbers a session can claim, one per concurrent event. Falls back to the
     * single `TWILIO_PHONE_NUMBER`, which caps you at one live session — the
     * ConversationRelay agent resolves a session from the *called* number, so
     * two concurrent events sharing one sender cannot be told apart.
     */
    phonePool: envList('TWILIO_PHONE_POOL').length
      ? envList('TWILIO_PHONE_POOL')
      : [requireEnv('TWILIO_PHONE_NUMBER')],
    /**
     * Conversation Memory store holding the audience's Customer Profiles.
     * Optional on purpose: absent, `services/memory.ts` is a no-op and every
     * personalized message falls back to this session's Sync responses. A
     * missing store must degrade the demo, not stop the backend booting.
     */
    memoryStoreId: process.env.TWILIO_MEMORY_STORE_ID || '',
    /**
     * A WhatsApp-enabled sender, `whatsapp:+…` or a bare E.164 number.
     *
     * Optional and separate from the phone pool on purpose: a WhatsApp sender is
     * registered per number with Meta, so a session's claimed pool number is
     * almost certainly not one. Unset, every WhatsApp trigger sends as SMS
     * instead — the message still lands, on the channel that always works.
     */
    whatsappFrom: normalizeWhatsAppSender(process.env.TWILIO_WHATSAPP_FROM),
  },
  /**
   * Shared secret in the Conversation Orchestrator status-callback URL.
   *
   * Twilio documents no signature, retry policy or expected response for these
   * callbacks, so `X-Twilio-Signature` — how every `/api/voice/*` webhook is
   * authenticated — is not available here. A secret in the URL is what is left.
   *
   * Optional, and unset the webhook route refuses every request: the endpoint
   * runs an LLM turn and sends a message, so an unauthenticated one is worse
   * than an absent feature.
   */
  /**
   * Seeded into `presenter-allowlist` at boot if missing. An empty allowlist is
   * an unrecoverable lockout, so this is deliberately idempotent — it
   * self-heals after an accidental deletion.
   */
  presenterBootstrapPhones: envList('PRESENTER_BOOTSTRAP_PHONES'),
  /** Signs presenter session tokens. Required — no default, since a guessable
   *  secret is the same as no auth at all on routes that call real phones. */
  presenterJwtSecret: requireEnv('PRESENTER_JWT_SECRET'),
  // LLM provider/model/key come from LLM_* env vars, validated by
  // @twilio-preso/llm (llmConfigFromEnv) rather than duplicated here.
  dev: {
    // When true, skip Twilio Verify entirely: no SMS is sent and the code
    // below is accepted. For local development only.
    bypassVerify: process.env.DEV_BYPASS_VERIFY === 'true',
    bypassCode: process.env.DEV_BYPASS_CODE || '123456',
  },
} as const;
