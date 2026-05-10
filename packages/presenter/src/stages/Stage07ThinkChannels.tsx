import { FloatingText } from '../objects';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function Stage07ThinkChannels() {
  const dataRef = useRef<Group>(null);

  useFrame((state) => {
    if (dataRef.current) {
      dataRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.5;
    }
  });

  const doors = [
    { label: 'Phone', x: -3 },
    { label: 'Chat', x: 0 },
    { label: 'Email', x: 3 },
  ];

  return (
    <group>
      {/* Subtle side-to-side flowing data lines instead of particles */}
      <group ref={dataRef}>
        {Array.from({ length: 15 }).map((_, i) => (
          <mesh key={i} position={[(i - 7) * 1.2, -3.5, -1]}>
            <boxGeometry args={[0.02, 0.4 + Math.random() * 0.6, 0.02]} />
            <meshStandardMaterial color="#F22F46" emissive="#F22F46" emissiveIntensity={0.5} transparent opacity={0.3} />
          </mesh>
        ))}
      </group>

      <FloatingText position={[0, 2.8, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={10}>
        We've learned to think in channels.
      </FloatingText>

      {doors.map((door, i) => (
        <group key={door.label} position={[door.x, -0.2, 0]}>
          {/* Door frame */}
          <mesh>
            <boxGeometry args={[1.5, 3, 0.1]} />
            <meshStandardMaterial
              color="#0D1B2A"
              emissive="#F22F46"
              emissiveIntensity={0.15}
            />
          </mesh>
          {/* Door panel */}
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[1.3, 2.8, 0.02]} />
            <meshStandardMaterial color="#1a1a3e" />
          </mesh>
          <FloatingText position={[0, -1.8, 0.1]} fontSize={0.18} color="#F22F46" delay={0.4 + i * 0.2}>
            {door.label}
          </FloatingText>
          <pointLight position={[0, 0, 1]} color="#F22F46" intensity={0.4} distance={3} />
        </group>
      ))}
    </group>
  );
}
