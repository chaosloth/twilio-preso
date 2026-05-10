import { Canvas } from '@react-three/fiber';

export function App() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 60 }}
      gl={{ antialias: true, alpha: false }}
      style={{ width: '100vw', height: '100vh' }}
    >
      <color attach="background" args={['#0D1B2A']} />
      <ambientLight intensity={0.3} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#F22F46" />
      </mesh>
    </Canvas>
  );
}
