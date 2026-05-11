import './env.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { config } from './config.js';
import { initSync } from './services/sync.js';
import { tokenRoutes } from './routes/token.js';
import { verifyRoutes } from './routes/verify.js';
import { registerRoutes } from './routes/register.js';
import { triggerRoutes } from './routes/trigger.js';
import { adminRoutes } from './routes/admin.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(formbody);
await app.register(tokenRoutes);
await app.register(verifyRoutes);
await app.register(registerRoutes);
await app.register(triggerRoutes);
await app.register(adminRoutes);

app.get('/health', async () => ({ status: 'ok' }));

await initSync();
await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`Backend running on http://localhost:${config.port}`);
