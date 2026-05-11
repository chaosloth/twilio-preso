function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: parseInt(process.env.CONVERSATION_RELAY_PORT || '3003', 10),
  twilio: {
    accountSid: requireEnv('TWILIO_ACCOUNT_SID'),
    authToken: requireEnv('TWILIO_AUTH_TOKEN'),
    syncServiceSid: requireEnv('TWILIO_SYNC_SERVICE_SID'),
  },
  anthropic: {
    apiKey: requireEnv('ANTHROPIC_API_KEY'),
  },
} as const;
