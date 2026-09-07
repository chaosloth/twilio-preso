import type { FastifyInstance } from 'fastify';
import { requirePresenter } from '../services/auth.js';
import { addPresenter, listPresenters, removePresenter } from '../services/sessions.js';
import { lookupPhone } from '../services/verify.js';

interface AddBody {
  phone: string;
  name: string;
}

export async function presenterRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requirePresenter);

  app.get('/api/presenters', async () => ({ presenters: await listPresenters() }));

  app.post<{ Body: AddBody }>('/api/presenters', async (request, reply) => {
    const { phone, name } = request.body ?? {};
    if (!phone || !name) return reply.status(400).send({ error: 'phone and name are required' });

    // Store the E.164 form Verify will report back, or sign-in silently fails
    // to match the allowlist entry.
    const lookup = await lookupPhone(phone);
    if (!lookup.valid) {
      return reply
        .status(400)
        .send({ error: 'Invalid phone number. Include the country code (e.g. +61...)' });
    }

    return { presenter: await addPresenter(lookup.formatted, name, request.presenter!.phone) };
  });

  app.delete<{ Params: { phone: string } }>('/api/presenters/:phone', async (request, reply) => {
    const phone = decodeURIComponent(request.params.phone);

    // The one rule that keeps the allowlist from being emptied mid-demo. With
    // bootstrap seeding, this makes a lockout unreachable.
    if (phone === request.presenter!.phone) {
      return reply.status(400).send({ error: 'You cannot remove your own access' });
    }

    await removePresenter(phone);
    return { removed: phone };
  });
}
