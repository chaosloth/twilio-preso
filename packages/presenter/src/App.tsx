import { Canvas } from '@react-three/fiber';
import { useEffect } from 'react';
import { Camera } from './components/Camera';
import { StageContainer } from './components/Stage';
import { PostProcessing } from './components/PostProcessing';
import { useNavigation } from './hooks/useNavigation';
import { initPresenterSync } from './sync';
import { usePresenterStore } from './store';
import { STAGES, TOTAL_STAGES } from '@twilio-preso/shared';

function Scene() {
  useNavigation();
  return (
    <>
      <Camera />
      <ambientLight intensity={0.2} />
      <StageContainer />
      <PostProcessing />
    </>
  );
}

function HUD() {
  const participants = usePresenterStore((s) => s.totalParticipants);
  const stageIndex = usePresenterStore((s) => s.currentStageIndex);
  return (
    <>
      <div style={{ position: 'fixed', bottom: 16, right: 16, color: 'white', fontFamily: 'monospace', opacity: 0.5, fontSize: 12 }}>
        Stage {stageIndex + 1}/{TOTAL_STAGES} | {participants} connected
      </div>
      <img src="/images/twilio-logo-full.png" alt="Twilio" style={{ position: 'fixed', bottom: 16, left: 16, width: 72, height: 'auto', opacity: 0.4 }} />
    </>
  );
}

function InteractionIndicator() {
  const stageIndex = usePresenterStore((s) => s.currentStageIndex);
  const stage = STAGES[stageIndex];

  if (!stage?.interaction) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 18px',
      borderRadius: 30,
      background: 'rgba(239, 34, 58, 0.15)',
      border: '1px solid rgba(239, 34, 58, 0.4)',
      backdropFilter: 'blur(8px)',
      animation: 'pulse 2s infinite',
    }}>
      <div style={{ fontSize: 20 }}>📱</div>
      <span style={{ color: '#ef223a', fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 500 }}>
        Check your phone
      </span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

function ResponseStream() {
  const recentResponses = usePresenterStore((s) => s.recentResponses);
  const lastThree = recentResponses.slice(-3).reverse();

  if (lastThree.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      {lastThree.map((r, i) => (
        <div
          key={`${r.participantId}-${r.timestamp}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 8,
            background: 'rgba(0, 13, 37, 0.8)',
            border: '1px solid rgba(239, 34, 58, 0.2)',
            backdropFilter: 'blur(4px)',
            opacity: i === 0 ? 1 : i === 1 ? 0.7 : 0.4,
            transition: 'opacity 0.3s',
          }}
        >
          <span style={{ color: '#ef223a', fontSize: 12, fontWeight: 600 }}>
            {r.participantName}
          </span>
          <span style={{ color: '#babecc', fontSize: 12 }}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function App() {
  useEffect(() => {
    initPresenterSync().catch(() => {});
  }, []);

  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ width: '100vw', height: '100vh' }}
      >
        <color attach="background" args={['#000d25']} />
        <fog attach="fog" args={['#000d25', 15, 40]} />
        <Scene />
      </Canvas>
      <InteractionIndicator />
      <ResponseStream />
      <HUD />
    </>
  );
}
