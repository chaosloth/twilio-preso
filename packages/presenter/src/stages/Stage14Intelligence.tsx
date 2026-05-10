import { FloatingText, ParticleField, SceneAccents } from '../objects';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function Stage14Intelligence() {
  const waveRef = useRef<Group>(null);

  useFrame((state) => {
    if (waveRef.current) {
      waveRef.current.children.forEach((child, i) => {
        child.scale.y = 0.5 + Math.abs(Math.sin(state.clock.elapsedTime * 3 + i * 0.5)) * 2;
      });
    }
  });

  return (
    <group>
      <FloatingText position={[0, 2.8, 0]} fontSize={0.45} color="#ef223a" bold delay={0}>
        Conversation Intelligence
      </FloatingText>
      <FloatingText position={[0, 2.0, 0]} fontSize={0.13} color="#7e869c" delay={0.3}>
        GA
      </FloatingText>

      <FloatingText position={[-3.5, 1.5, 0]} fontSize={0.2} color="#ffffff" delay={0.4} maxWidth={4} anchorX="left">
        Real-time Reasoning Engine
      </FloatingText>
      <FloatingText position={[-3.5, 0.5, 0]} fontSize={0.2} color="#ffffff" delay={0.6} maxWidth={4} anchorX="left">
        Persistent Customer Context
      </FloatingText>
      <FloatingText position={[-3.5, -0.5, 0]} fontSize={0.2} color="#ffffff" delay={0.8} maxWidth={4} anchorX="left">
        Customer and Business Aware Guidance
      </FloatingText>

      {/* Waveform visualization */}
      <group ref={waveRef} position={[2, 0, 0]}>
        {Array.from({ length: 30 }).map((_, i) => (
          <mesh key={i} position={[(i - 15) * 0.15, 0, 0]}>
            <boxGeometry args={[0.08, 0.3, 0.08]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? '#ef223a' : '#4488ff'}
              emissive={i % 3 === 0 ? '#ef223a' : '#4488ff'}
              emissiveIntensity={0.8}
            />
          </mesh>
        ))}
      </group>

      <ParticleField count={100} spread={8} color="#4488ff" speed={0.1} size={0.015} />
      <pointLight position={[2, 0, 2]} color="#4488ff" intensity={1} distance={6} />
      <pointLight position={[-2, 2, 2]} color="#ef223a" intensity={0.8} distance={6} />
      <SceneAccents count={10} spread={12} seed={14} />
    </group>
  );
}
