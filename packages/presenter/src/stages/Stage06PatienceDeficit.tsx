import { FloatingText, ParticleField, SceneAccents } from '../objects';
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
      <ParticleField count={100} color="#ef223a" speed={0.05} spread={12} size={0.012} />

      <FloatingText position={[0, 2.8, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2}>
        The Patience Deficit
      </FloatingText>

      {/* Clock face - smaller, positioned left */}
      <group ref={clockRef} position={[-3.5, 0.5, 0]}>
        <mesh>
          <ringGeometry args={[0.9, 1.05, 64]} />
          <meshStandardMaterial color="#ef223a" emissive="#ef223a" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 0.3, 0.1]}>
          <boxGeometry args={[0.03, 0.6, 0.02]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* Wait time cards - 2x2 grid */}
      <FloatingText position={[-0.5, 0.8, 0]} fontSize={0.35} color="#ef223a" bold delay={0.5}>
        +1 min
      </FloatingText>
      <FloatingText position={[-0.5, 0.35, 0]} fontSize={0.12} color="#7e869c" delay={0.6}>
        Financial disputes
      </FloatingText>

      <FloatingText position={[3, 0.8, 0]} fontSize={0.35} color="#ef223a" bold delay={0.7}>
        +7 min
      </FloatingText>
      <FloatingText position={[3, 0.35, 0]} fontSize={0.12} color="#7e869c" delay={0.8}>
        Troubleshooting
      </FloatingText>

      <FloatingText position={[-0.5, -0.8, 0]} fontSize={0.35} color="#ef223a" bold delay={0.9}>
        +2 min
      </FloatingText>
      <FloatingText position={[-0.5, -1.25, 0]} fontSize={0.12} color="#7e869c" delay={1}>
        Loan/policy
      </FloatingText>

      <FloatingText position={[3, -0.8, 0]} fontSize={0.35} color="#ef223a" bold delay={1.1}>
        +8 min
      </FloatingText>
      <FloatingText position={[3, -1.25, 0]} fontSize={0.12} color="#7e869c" delay={1.2}>
        Travel compensation
      </FloatingText>

      <FloatingText position={[0, -2.5, 0]} fontSize={0.1} color="#4d5777" delay={1.5}>
        Source: Decoding Digital Patience Report, Twilio
      </FloatingText>

      <SceneAccents count={8} spread={10} seed={6} />
      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={1.5} distance={8} />
    </group>
  );
}
