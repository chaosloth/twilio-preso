import { useState, useEffect, useRef } from 'react';
import { STAGES } from '@twilio-preso/shared';

export function NotesApp() {
  const [stageIndex, setStageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
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

  return (
    <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", padding: 24, background: '#000d25', color: 'white', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid #1a2540', paddingBottom: 16 }}>
        <h1 style={{ fontSize: 13, opacity: 0.5, letterSpacing: 2, textTransform: 'uppercase' }}>Presenter Notes</h1>
        <div style={{ display: 'flex', gap: 20, fontSize: 14 }}>
          <span style={{ color: '#ef223a', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: '#ef223a', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>
          Stage {stageIndex + 1} / {STAGES.length} — Act {currentStage?.act}
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 16, fontFamily: "'Tektur', sans-serif" }}>
          {currentStage?.title}
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: '#babecc' }}>
          {currentStage?.notes}
        </p>

        {currentStage?.interaction && (
          <div style={{ marginTop: 16, padding: 14, background: 'rgba(239,34,58,0.08)', borderRadius: 8, border: '1px solid rgba(239,34,58,0.25)' }}>
            <div style={{ fontSize: 11, color: '#ef223a', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>
              Interaction: {currentStage.interaction.type}
            </div>
            <div style={{ fontSize: 14, color: '#babecc' }}>{currentStage.interaction.prompt}</div>
            {currentStage.interaction.options && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#7e869c' }}>
                Options: {currentStage.interaction.options.join(' | ')}
              </div>
            )}
          </div>
        )}

        {currentStage?.demoTrigger && (
          <div style={{ marginTop: 12, padding: 14, background: 'rgba(100,149,237,0.08)', borderRadius: 8, border: '1px solid rgba(100,149,237,0.25)' }}>
            <div style={{ fontSize: 11, color: 'cornflowerblue', letterSpacing: 1, textTransform: 'uppercase' }}>
              Demo: {currentStage.demoTrigger}
            </div>
          </div>
        )}
      </div>

      {nextStage && (
        <div style={{ marginBottom: 32, opacity: 0.5 }}>
          <div style={{ fontSize: 11, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Next</div>
          <div style={{ fontSize: 18 }}>{nextStage.title}</div>
        </div>
      )}

      <div style={{ borderTop: '1px solid #1a2540', paddingTop: 16 }}>
        <div style={{ fontSize: 11, marginBottom: 10, opacity: 0.5, letterSpacing: 1, textTransform: 'uppercase' }}>Jump to Stage</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {STAGES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => handleGoTo(i)}
              style={{
                width: 30,
                height: 30,
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
    </div>
  );
}
