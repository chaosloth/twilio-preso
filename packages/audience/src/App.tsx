import { useState, useCallback, useEffect } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';
import { initSync, subscribeToEvents, publishResponse, isSyncConnected, isSyncDead, shutdownSync } from './sync';
import { Join } from './pages/Join';
import {
  joinCodeFromPath,
  loadSession,
  saveSession,
  type JoinedSession,
} from './session';
import { Register } from './pages/Register';
import { Waiting } from './pages/Waiting';
import { Poll } from './pages/Poll';
import { TextInput } from './pages/TextInput';
import { Trigger } from './pages/Trigger';
import { Sentiment } from './pages/Sentiment';
import { AIPrompt } from './pages/AIPrompt';

type AppState = 'join' | 'register' | 'waiting' | 'interaction';

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div style={{
      position: 'fixed',
      top: 12,
      right: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 20,
      background: 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(8px)',
      fontSize: 11,
      color: connected ? '#4ade80' : '#9ca3af',
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: connected ? '#4ade80' : '#6b7280',
        boxShadow: connected ? '0 0 6px #4ade80' : 'none',
      }} />
      {connected ? 'Connected' : 'Reconnecting...'}
    </div>
  );
}

export function App() {
  /** Resolved by the join screen — nothing below it can run without one. */
  const [session, setSession] = useState<JoinedSession | null>(null);
  const [state, setState] = useState<AppState>('join');
  const [participantId, setParticipantId] = useState('');
  const [name, setName] = useState('');
  const [activeInteraction, setActiveInteraction] = useState<InteractionConfig | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [connected, setConnected] = useState(false);

  const connectSync = useCallback(async (sessionId: string, id: string) => {
    try {
      await initSync(sessionId, id);
      await subscribeToEvents(
        (interaction, stageIndex) => {
          setActiveInteraction(interaction);
          setActiveStageIndex(stageIndex);
          setState('interaction');
        },
        () => {
          setActiveInteraction(null);
          setState('waiting');
        }
      );
      setConnected(true);
    } catch {
      setConnected(false);
      // Retry after 3 seconds
      setTimeout(() => connectSync(sessionId, id), 3000);
    }
  }, []);

  /**
   * A session resolved by the join screen. If this device already registered for
   * *this* session, resume straight into it — storage is namespaced per session,
   * so a participant id from another event can never be reused here.
   */
  const handleJoined = useCallback(
    (joined: JoinedSession) => {
      setSession(joined);
      const stored = loadSession(joined.sessionId);
      if (!stored) {
        setState('register');
        return;
      }
      setParticipantId(stored.participantId);
      setName(stored.name);
      setState('waiting');
      void connectSync(joined.sessionId, stored.participantId);
    },
    [connectSync]
  );

  // Poll the connection, and rebuild the client if it has died for good. A
  // phone that sat locked through a token expiry used to sit on "Connected"
  // forever while the presenter advanced past it.
  useEffect(() => {
    if (state === 'join' || state === 'register' || !session || !participantId) return;
    const interval = setInterval(() => {
      setConnected(isSyncConnected());
      if (isSyncDead()) {
        void shutdownSync().then(() => connectSync(session.sessionId, participantId));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [state, session, participantId, connectSync]);

  const handleRegistered = useCallback(async (id: string, participantName: string) => {
    if (!session) return;
    setParticipantId(id);
    setName(participantName);
    setState('waiting');
    saveSession({ ...session, participantId: id, name: participantName });
    await connectSync(session.sessionId, id);
  }, [connectSync, session]);

  const handleResponse = useCallback((value: string) => {
    if (!activeInteraction || !session) return;
    publishResponse(
      session.sessionId,
      participantId,
      name,
      activeInteraction.stageId,
      activeStageIndex,
      activeInteraction.type,
      value
    );
  }, [session, participantId, name, activeInteraction, activeStageIndex]);

  if (state === 'join' || !session) {
    return <Join initialCode={joinCodeFromPath(window.location.pathname)} onJoined={handleJoined} />;
  }

  if (state === 'register') {
    return <Register sessionId={session.sessionId} onRegistered={handleRegistered} />;
  }

  const content = (() => {
    if (state === 'waiting' || !activeInteraction) {
      return <Waiting name={name} />;
    }
    switch (activeInteraction.type) {
      case 'poll':
        return <Poll interaction={activeInteraction} onSubmit={handleResponse} />;
      case 'text':
        return <TextInput interaction={activeInteraction} onSubmit={handleResponse} />;
      case 'trigger':
        return <Trigger interaction={activeInteraction} onSubmit={handleResponse} />;
      case 'sentiment':
        return <Sentiment interaction={activeInteraction} onSubmit={handleResponse} />;
      case 'llm-prompt':
        return <AIPrompt interaction={activeInteraction} stageIndex={activeStageIndex} sessionId={session.sessionId} participantId={participantId} name={name} />;
      default:
        return <Waiting name={name} />;
    }
  })();

  return (
    <>
      <ConnectionBadge connected={connected} />
      {content}
    </>
  );
}
