import { FloatingText, ParticleField } from '../objects';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function Stage06PatienceDeficit() {
  const clockRef = useRef<Group>(null);

  useFrame((state) => {
    if (clockRef.current) {
      clockRef.current.rotation.z = -state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <group>
      <ParticleField count={200} color="#F22F46" speed={0.05} spread={12} size={0.02} />

      {/* Clock face */}
      <group ref={clockRef} position={[0, 0.5, 0]}>
        <mesh>
          <ringGeometry args={[1.8, 2, 64]} />
          <meshStandardMaterial color="#F22F46" emissive="#F22F46" emissiveIntensity={0.5} />
        </mesh>
        {/* Clock hand */}
        <mesh position={[0, 0.6, 0.1]}>
          <boxGeometry args={[0.05, 1.2, 0.02]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>

      <FloatingText position={[0, 3.5, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2}>
        The Patience Deficit
      </FloatingText>

      {/* Wait time cards */}
      <FloatingText position={[-2.5, -1.5, 0]} fontSize={0.5} color="#F22F46" bold delay={0.5}>
        +1 min
      </FloatingText>
      <FloatingText position={[-2.5, -2, 0]} fontSize={0.1} color="#888888" delay={0.6}>
        Financial disputes
      </FloatingText>

      <FloatingText position={[2.5, -1.5, 0]} fontSize={0.5} color="#F22F46" bold delay={0.8}>
        +7 min
      </FloatingText>
      <FloatingText position={[2.5, -2, 0]} fontSize={0.1} color="#888888" delay={0.9}>
        Troubleshooting
      </FloatingText>

      <FloatingText position={[-2.5, -3, 0]} fontSize={0.5} color="#F22F46" bold delay={1.1}>
        +2 min
      </FloatingText>
      <FloatingText position={[-2.5, -3.5, 0]} fontSize={0.1} color="#888888" delay={1.2}>
        Loan/policy
      </FloatingText>

      <FloatingText position={[2.5, -3, 0]} fontSize={0.5} color="#F22F46" bold delay={1.4}>
        +8 min
      </FloatingText>
      <FloatingText position={[2.5, -3.5, 0]} fontSize={0.1} color="#888888" delay={1.5}>
        Travel compensation
      </FloatingText>

      <pointLight position={[0, 2, 3]} color="#F22F46" intensity={1.5} distance={8} />
    </group>
  );
}
