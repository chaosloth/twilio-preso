import type { ResolvedStage } from '@twilio-preso/shared';

interface NotesTabProps {
  stages: ResolvedStage[];
  stageIndex: number;
  demoEnabled: boolean;
  zoom: number;
  onGoTo: (index: number) => void;
}

export function NotesTab({ stages, stageIndex, demoEnabled, zoom, onGoTo }: NotesTabProps) {
  const currentStage = stages[stageIndex];
  const nextStage = stages[stageIndex + 1];

  return (
    <>
      <div style={{ marginBottom: 24, fontSize: `${zoom}%` }}>
        <div style={{ fontSize: '0.7em', color: '#ef223a', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>
          Stage {stageIndex + 1} / {stages.length} — Act {currentStage?.act}
        </div>
        <h2 style={{ fontSize: '1.5em', fontWeight: 'bold', marginBottom: 12, fontFamily: "'Tektur', sans-serif" }}>
          {currentStage?.title}
        </h2>
        <p style={{ fontSize: '1em', lineHeight: 1.7, color: '#babecc' }}>{currentStage?.notes}</p>

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

      <div style={{ borderTop: '1px solid #1a2540', paddingTop: 14 }}>
        <div style={{ fontSize: 11, marginBottom: 8, opacity: 0.5, letterSpacing: 1, textTransform: 'uppercase' }}>Jump to Stage</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {stages.map((s, i) => (
            <button
              key={`${s.id}-${i}`}
              onClick={() => onGoTo(i)}
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
  );
}
