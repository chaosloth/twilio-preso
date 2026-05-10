import { Canvas } from '@react-three/fiber';
import { useEffect } from 'react';
import { Camera } from './components/Camera';
import { StageContainer } from './components/Stage';
import { PostProcessing } from './components/PostProcessing';
import { useNavigation } from './hooks/useNavigation';
import { initPresenterSync } from './sync';
import { usePresenterStore } from './store';

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
    <div style={{ position: 'fixed', bottom: 16, right: 16, color: 'white', fontFamily: 'monospace', opacity: 0.5, fontSize: 12 }}>
      Stage {stageIndex + 1}/19 | {participants} connected
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
      <HUD />
    </>
  );
}
