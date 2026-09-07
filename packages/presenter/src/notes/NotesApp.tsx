import { useState, useEffect, useRef } from 'react';
import { useAdminApi } from './useAdminApi';
import { AllowlistTab } from './tabs/AllowlistTab';
import { ControlsTab } from './tabs/ControlsTab';
import { DeckTab } from './tabs/DeckTab';
import { NotesTab } from './tabs/NotesTab';
import { ParticipantsTab } from './tabs/ParticipantsTab';

const TABS = ['notes', 'participants', 'controls', 'deck', 'presenters'] as const;
type Tab = (typeof TABS)[number];

interface NotesAppProps {
  /** Passed in the window URL by `useNavigation`. */
  sessionId: string;
}

/**
 * The presenter HUD: a separate browser window over the same session.
 *
 * This component is the chrome only — header, tabs, and the BroadcastChannel
 * link back to the presentation window. Everything that talks to the backend
 * lives in `useAdminApi`, and each tab renders one slice of it.
 */
export function NotesApp({ sessionId }: NotesAppProps) {
  const api = useAdminApi(sessionId);
  const { session, stages, participants, demoEnabled, setDemoMode } = api;

  const [stageIndex, setStageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('notes');
  const [zoom, setZoom] = useState(100);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const channel = new BroadcastChannel(`presenter-sync:${sessionId}`);
    channel.onmessage = (event) => {
      if (event.data.type === 'stage-change') setStageIndex(event.data.stageIndex);
    };
    return () => channel.close();
  }, [sessionId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // The deck editor and allowlist have text inputs; arrow keys belong to
      // them, not to slide navigation, while one is focused.
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        const next = Math.min(stageIndex + 1, stages.length - 1);
        if (next !== stageIndex) goTo(next);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        const prev = Math.max(stageIndex - 1, 0);
        if (prev !== stageIndex) goTo(prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stageIndex, stages.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;

  function goTo(index: number) {
    const channel = new BroadcastChannel(`presenter-sync:${sessionId}`);
    channel.postMessage({ type: 'go-to-stage', stageIndex: index });
    channel.close();
    setStageIndex(index);
  }

  function toggleDemo() {
    const next = !demoEnabled;
    // The presentation window keeps its own copy of the flag, so the toggle is
    // broadcast as well as written to the backend.
    const channel = new BroadcastChannel(`presenter-sync:${sessionId}`);
    channel.postMessage({ type: 'demo-toggle', enabled: next });
    channel.close();
    void setDemoMode(next);
  }

  const iconButton = {
    width: 22,
    height: 22,
    border: '1px solid #4d5777',
    background: 'transparent',
    color: '#fff',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 13,
    lineHeight: 1,
  } as const;

  return (
    <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", background: '#000d25', color: 'white', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #1a2540', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, opacity: 0.5, letterSpacing: 2, textTransform: 'uppercase' }}>
            {session?.title || 'Wonder'}
            {session?.joinCode && ` · ${session.joinCode}`}
          </span>
          <span style={{ color: '#ef223a', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 14 }}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setZoom((z) => Math.max(60, z - 10))} style={iconButton}>
            −
          </button>
          <span style={{ fontSize: 11, color: '#7e869c', minWidth: 32, textAlign: 'center' }}>{zoom}%</span>
          <button onClick={() => setZoom((z) => Math.min(200, z + 10))} style={iconButton}>
            +
          </button>
          <span style={{ fontSize: 12, color: '#7e869c', marginLeft: 8 }}>{participants.length} joined</span>
          <button
            onClick={toggleDemo}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              border: 'none',
              fontSize: 11,
              fontWeight: 'bold',
              cursor: 'pointer',
              background: demoEnabled ? '#ef223a' : '#4d5777',
              color: 'white',
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
            }}
          >
            {demoEnabled ? 'LIVE' : 'REHEARSAL'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #1a2540' }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: activeTab === tab ? '#0a1535' : 'transparent',
              color: activeTab === tab ? '#ffffff' : '#7e869c',
              cursor: 'pointer',
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              borderBottom: activeTab === tab ? '2px solid #ef223a' : '2px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* `index.html` sets `overflow: hidden` on html/body for the 3D canvas, so
          this pane is the only thing that can scroll — which needs the column
          above it to be a bounded `height: 100vh`, not `minHeight`. With
          minHeight the pane grew instead of scrolling and the Deck tab's lower
          stages (and their Activate buttons) were unreachable. `minHeight: 0`
          stops a long list from forcing the flex item taller than its track. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24 }}>
        {activeTab === 'notes' && (
          <NotesTab
            stages={stages}
            stageIndex={stageIndex}
            demoEnabled={demoEnabled}
            zoom={zoom}
            onGoTo={goTo}
          />
        )}
        {activeTab === 'participants' && <ParticipantsTab api={api} />}
        {activeTab === 'controls' && (
          <ControlsTab api={api} joinCode={session?.joinCode ?? ''} onToggleDemo={toggleDemo} />
        )}
        {activeTab === 'deck' && <DeckTab api={api} stageIndex={stageIndex} onGoTo={goTo} />}
        {activeTab === 'presenters' && <AllowlistTab />}
      </div>
    </div>
  );
}
