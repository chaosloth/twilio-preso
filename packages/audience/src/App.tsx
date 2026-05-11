import { useState, useCallback, useEffect } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';
import { initSync, subscribeToEvents, publishResponse, isSyncConnected } from './sync';
import { Register } from './pages/Register';
import { Waiting } from './pages/Waiting';
import { Poll } from './pages/Poll';
import { TextInput } from './pages/TextInput';
import { Trigger } from './pages/Trigger';
import { Sentiment } from './pages/Sentiment';

type AppState = 'register' | 'waiting' | 'interaction';

const SESSION_KEY = 'wonder-session';

interface SavedSession {
  participantId: string;
  name: string;
}

function getSavedSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession(participantId: string, name: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ participantId, name }));
}

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
  const saved = getSavedSession();
  const [state, setState] = useState<AppState>(saved ? 'waiting' : 'register');
  const [participantId, setParticipantId] = useState(saved?.participantId || '');
  const [name, setName] = useState(saved?.name || '');
  const [activeInteraction, setActiveInteraction] = useState<InteractionConfig | null>(null);
  const [connected, setConnected] = useState(false);

  const connectSync = useCallback(async (id: string) => {
    try {
      await initSync(id);
      await subscribeToEvents(
        (interaction) => {
          setActiveInteraction(interaction);
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
      setTimeout(() => connectSync(id), 3000);
    }
  }, []);

  // Reconnect on reload if session exists
  useEffect(() => {
    if (saved) {
      connectSync(saved.participantId);
    }
  }, []);

  // Periodically check connection status
  useEffect(() => {
    if (state === 'register') return;
    const interval = setInterval(() => {
      setConnected(isSyncConnected());
    }, 5000);
    return () => clearInterval(interval);
  }, [state]);

  const handleRegistered = useCallback(async (id: string, participantName: string) => {
    setParticipantId(id);
    setName(participantName);
    setState('waiting');
    saveSession(id, participantName);
    await connectSync(id);
  }, [connectSync]);

  const handleResponse = useCallback((value: string) => {
    if (!activeInteraction) return;
    publishResponse(
      participantId,
      name,
      activeInteraction.stageIndex,
      activeInteraction.type,
      value
    );
  }, [participantId, name, activeInteraction]);

  if (state === 'register') {
    return <Register onRegistered={handleRegistered} />;
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
