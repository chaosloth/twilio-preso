import { useState, useEffect, useRef } from 'react';
import { STAGES } from '@twilio-preso/shared';

const BACKEND_URL = 'http://localhost:3001';

interface ParticipantInfo {
  id: string;
  name: string;
  phone: string;
  company?: string;
  registeredAt: number;
}

export function NotesApp() {
  const [stageIndex, setStageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [demoEnabled, setDemoEnabled] = useState(true);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'notes' | 'participants' | 'controls'>('notes');
  const startTime = useRef(Date.now());

  useEffect(() => {
    const channel = new BroadcastChannel('presenter-sync');
    channel.onmessage = (event) => {
      if (event.data.type === 'stage-change') {
        setStageIndex(event.data.stageIndex);
      }
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll participants every 5 seconds
  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/admin/participants`);
        if (res.ok) {
          const data = await res.json();
          setParticipants(data.participants);
        }
      } catch {}
    };
    fetchParticipants();
    const interval = setInterval(fetchParticipants, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentStage = STAGES[stageIndex];
  const nextStage = STAGES[stageIndex + 1];
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;

  function handleGoTo(index: number) {
    const channel = new BroadcastChannel('presenter-sync');
    channel.postMessage({ type: 'go-to-stage', stageIndex: index });
    channel.close();
    setStageIndex(index);
  }

  async function handleRemoveParticipant(id: string) {
    await fetch(`${BACKEND_URL}/api/admin/participants/${id}`, { method: 'DELETE' });
    setParticipants((p) => p.filter((x) => x.id !== id));
  }

  async function handleReset() {
    if (!confirm('Reset all participants and demo state?')) return;
    await fetch(`${BACKEND_URL}/api/admin/reset`, { method: 'POST' });
    setParticipants([]);
  }

  function toggleDemo() {
    const newState = !demoEnabled;
    setDemoEnabled(newState);
    // Broadcast to presenter windows
    const channel = new BroadcastChannel('presenter-sync');
    channel.postMessage({ type: 'demo-toggle', enabled: newState });
    channel.close();
  }

  return (
    <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", background: '#000d25', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #1a2540', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, opacity: 0.5, letterSpacing: 2, textTransform: 'uppercase' }}>Wonder</span>
          <span style={{ color: '#ef223a', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 14 }}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#7e869c' }}>{participants.length} joined</span>
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
            }}
          >
            {demoEnabled ? 'LIVE' : 'REHEARSAL'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a2540' }}>
        {(['notes', 'participants', 'controls'] as const).map((tab) => (
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
              borderBottom: activeTab === tab ? '2px solid #ef223a' : '2px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {activeTab === 'notes' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: '#ef223a', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>
                Stage {stageIndex + 1} / {STAGES.length} — Act {currentStage?.act}
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 12, fontFamily: "'Tektur', sans-serif" }}>
                {currentStage?.title}
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: '#babecc' }}>
                {currentStage?.notes}
              </p>

              {currentStage?.interaction && (
                <div style={{ marginTop: 14, padding: 12, background: 'rgba(239,34,58,0.08)', borderRadius: 8, border: '1px solid rgba(239,34,58,0.25)' }}>
                  <div style={{ fontSize: 11, color: '#ef223a', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>
                    Interaction: {currentStage.interaction.type}
                  </div>
                  <div style={{ fontSize: 13, color: '#babecc' }}>{currentStage.interaction.prompt}</div>
                </div>
              )}

              {currentStage?.demoTrigger && (
                <div style={{ marginTop: 10, padding: 12, background: 'rgba(100,149,237,0.08)', borderRadius: 8, border: '1px solid rgba(100,149,237,0.25)' }}>
                  <div style={{ fontSize: 11, color: 'cornflowerblue', letterSpacing: 1, textTransform: 'uppercase' }}>
                    Demo: {currentStage.demoTrigger} {!demoEnabled && '(SKIPPED - rehearsal mode)'}
                  </div>
                </div>
              )}
            </div>

            {nextStage && (
              <div style={{ marginBottom: 24, opacity: 0.5 }}>
                <div style={{ fontSize: 11, marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>Next</div>
                <div style={{ fontSize: 16 }}>{nextStage.title}</div>
              </div>
            )}

            {/* Stage jump grid */}
            <div style={{ borderTop: '1px solid #1a2540', paddingTop: 14 }}>
              <div style={{ fontSize: 11, marginBottom: 8, opacity: 0.5, letterSpacing: 1, textTransform: 'uppercase' }}>Jump to Stage</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {STAGES.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => handleGoTo(i)}
                    style={{
                      width: 28,
                      height: 28,
                      border: i === stageIndex ? '2px solid #ef223a' : '1px solid #1a2540',
                      background: i === stageIndex ? 'rgba(239,34,58,0.15)' : 'transparent',
                      color: 'white',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontFamily: 'monospace',
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'participants' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 'bold' }}>Participants ({participants.length})</h3>
              <button
                onClick={handleReset}
                style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #ef223a', background: 'transparent', color: '#ef223a', cursor: 'pointer', fontSize: 11 }}
              >
                Reset All
              </button>
            </div>
            {participants.length === 0 ? (
              <p style={{ color: '#7e869c', fontSize: 14 }}>No participants yet. Share the QR code to get started.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {participants.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#0a1535', borderRadius: 6 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#7e869c' }}>{p.phone} {p.company && `· ${p.company}`}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveParticipant(p.id)}
                      style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #4d5777', background: 'transparent', color: '#7e869c', cursor: 'pointer', fontSize: 11 }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'controls' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>Demo Controls</h3>

            <div style={{ marginBottom: 24, padding: 16, background: '#0a1535', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Demo Mode</div>
                  <div style={{ fontSize: 12, color: '#7e869c' }}>
                    {demoEnabled ? 'SMS and calls will fire on demo stages' : 'All SMS and calls are suppressed'}
                  </div>
                </div>
                <button
                  onClick={toggleDemo}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    background: demoEnabled ? '#ef223a' : '#4d5777',
                    color: 'white',
                  }}
                >
                  {demoEnabled ? 'LIVE' : 'REHEARSAL'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24, padding: 16, background: '#0a1535', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Manual Triggers</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['sms-patience', 'sms-orchestrator', 'sms-memory', 'voice-mass-outbound', 'sms-closing'].map((trigger) => (
                  <button
                    key={trigger}
                    onClick={async () => {
                      if (confirm(`Fire ${trigger}?`)) {
                        await fetch(`${BACKEND_URL}/api/trigger`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ triggerId: trigger }),
                        });
                      }
                    }}
                    style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #4d5777', background: 'transparent', color: '#babecc', cursor: 'pointer', fontSize: 11 }}
                  >
                    {trigger}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: 16, background: '#0a1535', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Audience URL</div>
              <div style={{ fontSize: 12, color: '#7e869c', wordBreak: 'break-all' }}>
                Set VITE_AUDIENCE_URL to update the QR code on stage 1
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
