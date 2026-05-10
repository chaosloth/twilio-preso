function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  twilio: {
    accountSid: requireEnv('TWILIO_ACCOUNT_SID'),
    authToken: requireEnv('TWILIO_AUTH_TOKEN'),
    apiKeySid: requireEnv('TWILIO_API_KEY_SID'),
    apiKeySecret: requireEnv('TWILIO_API_KEY_SECRET'),
    syncServiceSid: requireEnv('TWILIO_SYNC_SERVICE_SID'),
    verifyServiceSid: requireEnv('TWILIO_VERIFY_SERVICE_SID'),
    messagingServiceSid: requireEnv('TWILIO_MESSAGING_SERVICE_SID'),
    phoneNumber: requireEnv('TWILIO_PHONE_NUMBER'),
  },
} as const;
