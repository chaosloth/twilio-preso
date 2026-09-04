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

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  /**
   * The externally-reachable origin, as Twilio sees it. Used to rebuild the URL
   * a webhook signature was computed over — behind Fly's proxy the request
   * itself reports http, so deriving this from the request would reject every
   * legitimate webhook.
   */
  publicBaseUrl:
    process.env.PUBLIC_BASE_URL ||
    process.env.BACKEND_URL ||
    `http://localhost:${process.env.PORT || '3001'}`,
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
  },
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
