import { FloatingText, ParticleField } from '../objects';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function Stage18MassCall() {
  const ringRef = useRef<Group>(null);
  const phonesRef = useRef<Group>(null);

  useFrame((state) => {
    if (ringRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.3;
      ringRef.current.scale.set(scale, scale, 1);
    }
    if (phonesRef.current) {
      phonesRef.current.rotation.z = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <group>
      <FloatingText position={[0, 3.5, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={10}>
        Every phone in the room...
      </FloatingText>
      <FloatingText position={[0, 2.7, 0]} fontSize={0.4} color="#F22F46" bold delay={0.5} maxWidth={10}>
        rings simultaneously.
      </FloatingText>

      {/* Pulsing ring */}
      <group ref={ringRef}>
        <mesh>
          <ringGeometry args={[2, 2.1, 64]} />
          <meshStandardMaterial color="#F22F46" emissive="#F22F46" emissiveIntensity={2} />
        </mesh>
      </group>

      {/* Phone icons radiating outward */}
      <group ref={phonesRef}>
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const radius = 3.5;
          return (
            <mesh key={i} position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]}>
              <boxGeometry args={[0.2, 0.35, 0.05]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
            </mesh>
          );
        })}
      </group>

      {/* Center burst */}
      <pointLight position={[0, 0, 2]} color="#F22F46" intensity={3} distance={8} />
      <ParticleField count={400} spread={8} color="#F22F46" speed={0.8} size={0.03} />
    </group>
  );
}
