import { FloatingText, ParticleField, SceneAccents } from '../objects';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

export default function Stage12Orchestrator() {
  const flowRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (flowRef.current) {
      flowRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.5) * 3;
    }
  });

  return (
    <group>
      <FloatingText position={[0, 2.8, 0]} fontSize={0.45} color="#ef223a" bold delay={0}>
        Conversation Orchestrator
      </FloatingText>
      <FloatingText position={[0, 2.0, 0]} fontSize={0.13} color="#7e869c" delay={0.3}>
        GA
      </FloatingText>

      <FloatingText position={[-3, 1.5, 0]} fontSize={0.2} color="#ffffff" delay={0.4} maxWidth={4}>
        Unified Continuous Conversation
      </FloatingText>
      <FloatingText position={[-3, 0.5, 0]} fontSize={0.2} color="#ffffff" delay={0.6} maxWidth={4}>
        Connected AI-Human Handoff
      </FloatingText>
      <FloatingText position={[-3, -0.5, 0]} fontSize={0.2} color="#ffffff" delay={0.8} maxWidth={4}>
        Seamless Channel Expansion
      </FloatingText>

      {/* Flowing message indicator */}
      <mesh ref={flowRef} position={[0, -1.5, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ef223a" emissive="#ef223a" emissiveIntensity={2} />
      </mesh>

      {/* Channel line */}
      <mesh position={[0, -1.5, 0]}>
        <boxGeometry args={[8, 0.02, 0.02]} />
        <meshStandardMaterial color="#ef223a" emissive="#ef223a" emissiveIntensity={0.5} />
      </mesh>

      <ParticleField count={150} spread={10} color="#ef223a" speed={0.1} size={0.015} />
      <pointLight position={[0, 0, 3]} color="#ef223a" intensity={1.5} distance={8} />
      <SceneAccents count={10} spread={12} seed={12} />
    </group>
  );
}
