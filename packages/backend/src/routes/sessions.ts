import type { FastifyInstance } from 'fastify';
import {
  COUNTRY_CODES,
  VERIFY_CHANNELS,
  resolveRelayConfig,
  resolveTextConfig,
  toPublicSession,
  validateDeck,
} from '@twilio-preso/shared';
import type { Deck, RelayConfig, TextAgentConfig, VerifyChannel } from '@twilio-preso/shared';
import { requirePresenter } from '../services/auth.js';
import {
  PhonePoolExhaustedError,
  createSession,
  describePoolUsage,
  endSession,
  getSessionByCode,
  getSessionById,
  listSessions,
  setSessionDeck,
  setSessionRelay,
  setSessionText,
  setSessionStatus,
  setSessionCountryCode,
  setSessionCountryCodes,
  setSessionVerifyChannel,
} from '../services/sessions.js';
import { getAllParticipants } from '../services/sync.js';
import { buildSnapshot, snapshotFilename, toCsv } from '../services/export.js';

interface CreateBody {
  title?: string;
  deck?: Deck;
}

/**
 * The only public session endpoint. Rate-limited because a guessed join code is
 * the entire attack path, and returns only what the join screen needs — never
 * the deck, the owner, or the session's phone number.
 */
export async function publicSessionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { code: string } }>(
    '/api/session/:code',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const session = await getSessionByCode(request.params.code);
      if (!session) return reply.status(404).send({ error: 'Unknown join code' });
      return toPublicSession(session);
    }
  );
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requirePresenter);

  app.get('/api/sessions', async () => ({ sessions: await listSessions() }));

  /** Which pooled numbers are free, and which event holds each of the rest. */
  app.get('/api/sessions/phone-pool', async () => ({ inUse: await describePoolUsage() }));

  app.get<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
    const session = await getSessionById(request.params.id);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    return { session, warnings: validateDeck(session.deck) };
  });

  app.post<{ Body: CreateBody }>('/api/sessions', async (request, reply) => {
    const title = request.body?.title?.trim();
    if (!title) return reply.status(400).send({ error: 'title is required' });

    try {
      const session = await createSession({
        title,
        ownerPhone: request.presenter!.phone,
        deck: request.body?.deck,
      });
      return { session, warnings: validateDeck(session.deck) };
    } catch (err) {
      if (err instanceof PhonePoolExhaustedError) {
        // 409 with the holders listed, so the presenter can go end the stale
        // event rather than being told "no" with nowhere to go.
        return reply.status(409).send({ error: err.message, inUse: err.inUse });
      }
      throw err;
    }
  });

  /**
   * Deck editing. Warnings are returned, never enforced — a reordered deck that
   * breaks a dependency is a judgement call for the presenter, surfaced in the
   * HUD, not something to refuse mid-preparation.
   */
  app.put<{ Params: { id: string }; Body: { deck: Deck } }>(
    '/api/sessions/:id/deck',
    async (request, reply) => {
      const deck = request.body?.deck;
      if (!deck?.stages) return reply.status(400).send({ error: 'deck.stages is required' });

      const session = await setSessionDeck(request.params.id, deck);
      if (!session) return reply.status(404).send({ error: 'Session not found' });
      return { session, warnings: validateDeck(session.deck) };
    }
  );

  /**
   * Voice-agent settings for this presentation: instructions, greeting, tools,
   * voice, language and ASR. Returned resolved (defaults merged in) so the HUD
   * edits real values rather than blanks, but stored as the partial that was
   * sent — see `setSessionRelay`.
   */
  app.get<{ Params: { id: string } }>('/api/sessions/:id/relay', async (request, reply) => {
    const session = await getSessionById(request.params.id);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    return { relay: resolveRelayConfig(session.relay), stored: session.relay ?? {} };
  });

  app.put<{ Params: { id: string }; Body: { relay: Partial<RelayConfig> } }>(
    '/api/sessions/:id/relay',
    async (request, reply) => {
      const relay = request.body?.relay;
      if (!relay || typeof relay !== 'object') {
        return reply.status(400).send({ error: 'relay object is required' });
      }
      // Resolved before storing, so an unknown key from a hand-edited payload is
      // dropped at the boundary rather than sitting in the record waiting to be
      // read by something less careful.
      const session = await setSessionRelay(request.params.id, resolveRelayConfig(relay));
      if (!session) return reply.status(404).send({ error: 'Session not found' });
      return { session, relay: resolveRelayConfig(session.relay) };
    }
  );

  /**
   * Text-agent settings: the same shape of edit as the voice tab, for the agent
   * an attendee reaches by replying to a message rather than by answering a call.
   */
  app.get<{ Params: { id: string } }>('/api/sessions/:id/text', async (request, reply) => {
    const session = await getSessionById(request.params.id);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    return { text: resolveTextConfig(session.text), stored: session.text ?? {} };
  });

  app.put<{ Params: { id: string }; Body: { text: Partial<TextAgentConfig> } }>(
    '/api/sessions/:id/text',
    async (request, reply) => {
      const text = request.body?.text;
      if (!text || typeof text !== 'object') {
        return reply.status(400).send({ error: 'text object is required' });
      }
      const session = await setSessionText(request.params.id, resolveTextConfig(text));
      if (!session) return reply.status(404).send({ error: 'Session not found' });
      return { session, text: resolveTextConfig(session.text) };
    }
  );

  app.put<{ Params: { id: string }; Body: { status: 'draft' | 'live' } }>(
    '/api/sessions/:id/status',
    async (request, reply) => {
      const status = request.body?.status;
      // Ending is its own endpoint — it releases a number and destroys Sync
      // objects, so it must not be reachable through a generic status write.
      if (status !== 'draft' && status !== 'live') {
        return reply.status(400).send({ error: "status must be 'draft' or 'live'" });
      }

      const session = await setSessionStatus(request.params.id, status);
      if (!session) return reply.status(404).send({ error: 'Session not found' });
      return { session };
    }
  );

  /** The registration channel. Its own endpoint rather than part of the relay
   *  config: it governs the door, not the voice agent. */
  app.put<{ Params: { id: string }; Body: { verifyChannel?: string } }>(
    '/api/sessions/:id/verify-channel',
    async (request, reply) => {
      const channel = request.body?.verifyChannel;
      if (!VERIFY_CHANNELS.includes(channel as VerifyChannel)) {
        return reply.status(400).send({ error: "verifyChannel must be 'whatsapp' or 'sms'" });
      }
      const session = await setSessionVerifyChannel(request.params.id, channel as VerifyChannel);
      if (!session) return reply.status(404).send({ error: 'Session not found' });
      return { session };
    }
  );

  /** The dialling code the audience registration screen starts on. Its own
   *  endpoint for the same reason as the channel: it governs the door. */
  app.put<{ Params: { id: string }; Body: { countryCode?: string } }>(
    '/api/sessions/:id/country-code',
    async (request, reply) => {
      const countryCode = request.body?.countryCode;
      if (!COUNTRY_CODES.includes(countryCode ?? '')) {
        return reply
          .status(400)
          .send({ error: `countryCode must be one of ${COUNTRY_CODES.join(', ')}` });
      }
      const session = await setSessionCountryCode(request.params.id, countryCode as string);
      if (!session) return reply.status(404).send({ error: 'Session not found' });
      return { session };
    }
  );

  /** Which dialling codes that screen offers at all. Separate from the default
   *  above because narrowing the list and choosing within it are two decisions,
   *  and the presenter makes them at different moments. */
  app.put<{ Params: { id: string }; Body: { countryCodes?: string[] } }>(
    '/api/sessions/:id/countries',
    async (request, reply) => {
      const countryCodes = request.body?.countryCodes;
      if (!Array.isArray(countryCodes)) {
        return reply.status(400).send({ error: 'countryCodes must be an array of dialling codes' });
      }
      const unknown = countryCodes.filter((c) => !COUNTRY_CODES.includes(c));
      if (unknown.length) {
        return reply.status(400).send({ error: `unknown dialling codes: ${unknown.join(', ')}` });
      }
      const session = await setSessionCountryCodes(request.params.id, countryCodes);
      if (!session) return reply.status(404).send({ error: 'Session not found' });
      return { session };
    }
  );

  app.get<{ Params: { id: string }; Querystring: { format?: string } }>(
    '/api/sessions/:id/export',
    async (request, reply) => {
      const session = await getSessionById(request.params.id);
      if (!session) return reply.status(404).send({ error: 'Session not found' });

      const participants = await getAllParticipants(session.id);

      if (request.query.format === 'csv') {
        // A download rather than a file on disk: this backend runs on ephemeral
        // storage, so anything written server-side is gone at the next deploy.
        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header(
          'Content-Disposition',
          `attachment; filename="${snapshotFilename(session, 'csv')}"`
        );
        return toCsv(session, participants);
      }

      return buildSnapshot(session, participants);
    }
  );

  /**
   * Ends the session: releases its number and deletes its four Sync objects.
   * The snapshot comes back in the response body — teardown is irreversible, so
   * the data leaves with the same call that destroys it rather than depending on
   * the presenter having remembered to export first.
   */
  app.post<{ Params: { id: string } }>('/api/sessions/:id/end', async (request, reply) => {
    const existing = await getSessionById(request.params.id);
    if (!existing) return reply.status(404).send({ error: 'Session not found' });

    const participants = await getAllParticipants(existing.id);
    const snapshot = buildSnapshot(existing, participants);
    const csv = toCsv(existing, participants);

    const session = await endSession(existing.id);
    return { session, snapshot, csv, filenames: {
      json: snapshotFilename(existing, 'json'),
      csv: snapshotFilename(existing, 'csv'),
    } };
  });
}
