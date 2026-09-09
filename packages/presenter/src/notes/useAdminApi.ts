import { useCallback, useEffect, useState } from 'react';
import type { Deck, DeckWarning, ResolvedStage, SessionRecord, VerifyChannel } from '@twilio-preso/shared';
import { presenterFetch } from '../auth';
import { fetchSession, saveDeck, stagesFor } from '../sessions';

export interface ParticipantInfo {
  id: string;
  name: string;
  phone: string;
  company?: string;
  registeredAt: number;
}

const PARTICIPANT_POLL_MS = 5000;

/**
 * The backend's own words for a failure, thrown rather than swallowed.
 *
 * These calls used to resolve regardless of status, so a trigger refused with
 * `409 not armed` looked identical to one that placed a room's worth of calls.
 * The HUD button is the only place a presenter finds out, so it has to be told.
 */
async function ok(res: Response): Promise<Response> {
  if (res.ok) return res;
  const body = await res.json().catch(() => ({}) as { error?: string });
  throw new Error(body.error || `${res.status} ${res.statusText}`);
}

/**
 * Everything the HUD tabs need from the backend, in one place.
 *
 * The tabs are presentation only — splitting the fetching out is what let
 * NotesApp stop being a single 400-line component. Every call is
 * session-scoped: `sessionId` goes in the query string for GET/DELETE and the
 * body for POST, and `presenterFetch` attaches the bearer token.
 */
export function useAdminApi(sessionId: string) {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [stages, setStages] = useState<ResolvedStage[]>([]);
  const [warnings, setWarnings] = useState<DeckWarning[]>([]);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  /**
   * The outbound-Twilio gate. Defaults to off and is corrected from the backend
   * on load — never assume armed, or a rehearsal calls real phones.
   */
  const [demoEnabled, setDemoEnabled] = useState(false);

  // The deck is fetched rather than imported: this window has its own React
  // root and store, and what it shows must be the session's own running order.
  const reloadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const result = await fetchSession(sessionId);
      setSession(result.session);
      setStages(stagesFor(result.session));
      setWarnings(result.warnings);
    } catch {}
  }, [sessionId]);

  const reloadParticipants = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await presenterFetch(`/api/admin/participants?sessionId=${sessionId}`);
      if (res.ok) setParticipants((await res.json()).participants);
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    void reloadSession();
  }, [reloadSession]);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const res = await presenterFetch(`/api/admin/mode?sessionId=${sessionId}`);
        if (res.ok) setDemoEnabled((await res.json()).isLive);
      } catch {}
    })();
  }, [sessionId]);

  useEffect(() => {
    void reloadParticipants();
    const interval = setInterval(reloadParticipants, PARTICIPANT_POLL_MS);
    return () => clearInterval(interval);
  }, [reloadParticipants]);

  const setDemoMode = useCallback(
    async (isLive: boolean) => {
      setDemoEnabled(isLive);
      try {
        await ok(
          await presenterFetch('/api/admin/mode', {
            method: 'POST',
            body: JSON.stringify({ sessionId, isLive }),
          })
        );
      } catch (err) {
        // The gate did not move, so neither may the switch: a toggle that reads
        // LIVE while the backend is still in rehearsal is the worst of both.
        setDemoEnabled(!isLive);
        throw err;
      }
    },
    [sessionId]
  );

  const removeParticipant = useCallback(
    async (id: string) => {
      await ok(
        await presenterFetch(`/api/admin/participants/${id}?sessionId=${sessionId}`, {
          method: 'DELETE',
        })
      );
      setParticipants((p) => p.filter((x) => x.id !== id));
    },
    [sessionId]
  );

  const resetSession = useCallback(async () => {
    await ok(
      await presenterFetch('/api/admin/reset', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      })
    );
    setParticipants([]);
  }, [sessionId]);

  const fireTrigger = useCallback(
    async (triggerId: string, targetParticipantId?: string) => {
      await ok(
        await presenterFetch('/api/trigger', {
          method: 'POST',
          body: JSON.stringify({ sessionId, triggerId, targetParticipantId }),
        })
      );
    },
    [sessionId]
  );

  /** Which channel the registration screen offers first. Session-scoped because a
   *  room whose WhatsApp sender is not approved yet needs SMS on the door. */
  const setVerifyChannel = useCallback(
    async (verifyChannel: VerifyChannel) => {
      const res = await ok(
        await presenterFetch(`/api/sessions/${sessionId}/verify-channel`, {
          method: 'PUT',
          body: JSON.stringify({ verifyChannel }),
        })
      );
      const data = await res.json().catch(() => ({}));
      if (data.session) setSession(data.session as SessionRecord);
    },
    [sessionId]
  );

  /** The dialling code every phone's registration screen starts on. The room's
   *  country, so it belongs to the session rather than to the build. */
  const setCountryCode = useCallback(
    async (countryCode: string) => {
      const res = await ok(
        await presenterFetch(`/api/sessions/${sessionId}/country-code`, {
          method: 'PUT',
          body: JSON.stringify({ countryCode }),
        })
      );
      const data = await res.json().catch(() => ({}));
      if (data.session) setSession(data.session as SessionRecord);
    },
    [sessionId]
  );

  const commitDeck = useCallback(
    async (deck: Deck) => {
      const result = await saveDeck(sessionId, deck);
      setSession(result.session);
      setStages(stagesFor(result.session));
      setWarnings(result.warnings);
    },
    [sessionId]
  );

  return {
    session,
    stages,
    warnings,
    participants,
    demoEnabled,
    setDemoMode,
    removeParticipant,
    resetSession,
    fireTrigger,
    setVerifyChannel,
    setCountryCode,
    commitDeck,
    reloadSession,
  };
}

export type AdminApi = ReturnType<typeof useAdminApi>;
