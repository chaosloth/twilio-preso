import { useState, useCallback, useEffect } from 'react';
import type { InteractionConfig } from '@twilio-preso/shared';
import { initSync, subscribeToEvents, publishResponse } from './sync';
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

export function App() {
  const saved = getSavedSession();
  const [state, setState] = useState<AppState>(saved ? 'waiting' : 'register');
  const [participantId, setParticipantId] = useState(saved?.participantId || '');
  const [name, setName] = useState(saved?.name || '');
  const [activeInteraction, setActiveInteraction] = useState<InteractionConfig | null>(null);

  const connectSync = useCallback(async (id: string) => {
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
  }, []);

  // Reconnect on reload if session exists
  useEffect(() => {
    if (saved) {
      connectSync(saved.participantId);
    }
  }, []);

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
}
