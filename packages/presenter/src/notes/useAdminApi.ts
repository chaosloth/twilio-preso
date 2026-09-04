import { useCallback, useEffect, useState } from 'react';
import type { Deck, DeckWarning, ResolvedStage, SessionRecord } from '@twilio-preso/shared';
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
        await presenterFetch('/api/admin/mode', {
          method: 'POST',
          body: JSON.stringify({ sessionId, isLive }),
        });
      } catch {}
    },
    [sessionId]
  );

  const removeParticipant = useCallback(
    async (id: string) => {
      await presenterFetch(`/api/admin/participants/${id}?sessionId=${sessionId}`, {
        method: 'DELETE',
      });
      setParticipants((p) => p.filter((x) => x.id !== id));
    },
    [sessionId]
  );

  const resetSession = useCallback(async () => {
    await presenterFetch('/api/admin/reset', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
    setParticipants([]);
  }, [sessionId]);

  const fireTrigger = useCallback(
    async (triggerId: string) => {
      await presenterFetch('/api/trigger', {
        method: 'POST',
        body: JSON.stringify({ sessionId, triggerId }),
      });
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
    commitDeck,
    reloadSession,
  };
}

export type AdminApi = ReturnType<typeof useAdminApi>;
