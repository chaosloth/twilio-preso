import './env.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { initControlPlane } from './services/sessions.js';
import { tokenRoutes } from './routes/token.js';
import { verifyRoutes } from './routes/verify.js';
import { authRoutes } from './routes/auth.js';
import { presenterRoutes } from './routes/presenters.js';
import { sessionRoutes, publicSessionRoutes } from './routes/sessions.js';
import { registerRoutes } from './routes/register.js';
import { triggerRoutes } from './routes/trigger.js';
import { adminRoutes } from './routes/admin.js';
import { responseRoutes } from './routes/response.js';
import { aiPromptRoutes } from './routes/aiPrompt.js';
import { featureRoutes } from './routes/features.js';
import { orchestratorRoutes } from './routes/orchestrator.js';
import { describeContentTemplates } from './services/content.js';
import { isWhatsAppConfigured } from './services/messaging.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(formbody);
// Global ceiling; the public auth and join-code lookups tighten it per-route.
// A guessed join code is the whole attack path on the audience side.
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
await app.register(tokenRoutes);
await app.register(verifyRoutes);
await app.register(authRoutes);
await app.register(presenterRoutes);
await app.register(sessionRoutes);
await app.register(publicSessionRoutes);
await app.register(registerRoutes);
await app.register(triggerRoutes);
await app.register(adminRoutes);
await app.register(responseRoutes);
await app.register(aiPromptRoutes);
await app.register(featureRoutes);
await app.register(orchestratorRoutes);

app.get('/health', async () => ({ status: 'ok' }));

// Control-plane maps + allowlist bootstrap. Must precede listen: an empty
// allowlist means nobody can sign in.
await initControlPlane();
/**
 * Warm the approved-template cache, without waiting for it.
 *
 * `contentSidFor` reads the account on demand anyway, so this is only about the
 * first WhatsApp send of an event not paying for the listing — and it must not be
 * awaited: Content being slow or down is a plain-text message, never a backend
 * that will not boot.
 */
if (isWhatsAppConfigured()) {
  void describeContentTemplates().catch((err) =>
    app.log.warn({ err }, 'could not pre-read the WhatsApp content templates')
  );
}

await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`Backend running on http://localhost:${config.port}`);
