import type { VercelRequest, VercelResponse } from '@vercel/node';
import '../src/env.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { initSync } from '../src/services/sync.js';
import { tokenRoutes } from '../src/routes/token.js';
import { verifyRoutes } from '../src/routes/verify.js';
import { registerRoutes } from '../src/routes/register.js';
import { triggerRoutes } from '../src/routes/trigger.js';
import { adminRoutes } from '../src/routes/admin.js';
import { responseRoutes } from '../src/routes/response.js';

let app: ReturnType<typeof Fastify> | null = null;
let initialized = false;

async function getApp() {
  if (app) return app;
  app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(formbody);
  await app.register(tokenRoutes);
  await app.register(verifyRoutes);
  await app.register(registerRoutes);
  await app.register(triggerRoutes);
  await app.register(adminRoutes);
  await app.register(responseRoutes);
  app.get('/health', async () => ({ status: 'ok' }));
  await app.ready();
  if (!initialized) {
    try {
      await initSync();
    } catch {}
    initialized = true;
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fastify = await getApp();

  const response = await fastify.inject({
    method: req.method as any,
    url: req.url || '/',
    headers: req.headers as any,
    payload: req.body ? JSON.stringify(req.body) : undefined,
  });

  res.status(response.statusCode);
  for (const [key, value] of Object.entries(response.headers)) {
    if (value) res.setHeader(key, value as string);
  }
  res.end(response.body);
}
