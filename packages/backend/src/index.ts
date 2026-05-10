import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { initSync } from './services/sync.js';
import { tokenRoutes } from './routes/token.js';
import { verifyRoutes } from './routes/verify.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(tokenRoutes);
await app.register(verifyRoutes);

app.get('/health', async () => ({ status: 'ok' }));

await initSync();
await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`Backend running on http://localhost:${config.port}`);
