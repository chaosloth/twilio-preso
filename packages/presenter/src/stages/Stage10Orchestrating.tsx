import { FloatingText, ParticleField } from '../objects';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function Stage10Orchestrating() {
  const threadsRef = useRef<Group>(null);

  useFrame((state) => {
    if (threadsRef.current) {
      threadsRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <group>
      <FloatingText position={[0, 3, 0]} fontSize={0.35} color="#ffffff" bold delay={0.2} maxWidth={10}>
        You aren't just managing infrastructure anymore;
      </FloatingText>
      <FloatingText position={[0, 2, 0]} fontSize={0.35} color="#F22F46" bold delay={0.6} maxWidth={10}>
        you are orchestrating the customer's journey.
      </FloatingText>

      {/* Conductor silhouette - abstract geometric figure */}
      <mesh position={[0, -0.5, 0]}>
        <coneGeometry args={[0.5, 2, 4]} />
        <meshStandardMaterial color="#1a1a3e" emissive="#F22F46" emissiveIntensity={0.1} />
      </mesh>

      {/* Connecting threads */}
      <group ref={threadsRef}>
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(angle) * 3, Math.sin(angle) * 1.5, -0.5]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#F22F46" emissive="#F22F46" emissiveIntensity={1} />
            </mesh>
          );
        })}
      </group>

      <ParticleField count={300} spread={12} color="#F22F46" speed={0.15} size={0.02} />
      <pointLight position={[0, 3, 3]} color="#F22F46" intensity={2} distance={10} />
    </group>
  );
}
