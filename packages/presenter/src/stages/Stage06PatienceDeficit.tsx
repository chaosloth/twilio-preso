import { FloatingText, ParticleField, SceneAccents } from '../objects';
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import type { Group } from 'three';

const cards = [
  { time: '+1 min', label: 'Financial disputes', x: -2.5, y: 0.5 },
  { time: '+7 min', label: 'Troubleshooting', x: 2.5, y: 0.5 },
  { time: '+2 min', label: 'Loan/policy', x: -2.5, y: -1.5 },
  { time: '+8 min', label: 'Travel compensation', x: 2.5, y: -1.5 },
];

function TimeCard({ time, label, x, y, index }: { time: string; label: string; x: number; y: number; index: number }) {
  const ref = useRef<Group>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.scale.set(0, 0, 0);
    gsap.to(ref.current.scale, {
      x: 1, y: 1, z: 1,
      duration: 0.5,
      delay: 0.4 + index * 0.2,
      ease: 'back.out(1.5)',
    });
  }, [index]);

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = y + Math.sin(state.clock.elapsedTime * 0.6 + index * 1.5) * 0.04;
    }
  });

  return (
    <group ref={ref} position={[x, y, 0]}>
      {/* Card background */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[2.2, 1.2]} />
        <meshStandardMaterial color="#000d25" transparent opacity={0.95} />
      </mesh>
      {/* Border */}
      <mesh position={[0, 0, -0.03]}>
        <planeGeometry args={[2.25, 1.25]} />
        <meshStandardMaterial color="#ef223a" transparent opacity={0.3} />
      </mesh>
      <FloatingText position={[0, 0.2, 0]} fontSize={0.3} color="#ef223a" bold delay={0.5 + index * 0.2}>
        {time}
      </FloatingText>
      <FloatingText position={[0, -0.25, 0]} fontSize={0.12} color="#7e869c" delay={0.6 + index * 0.2}>
        {label}
      </FloatingText>
    </group>
  );
}

export default function Stage06PatienceDeficit() {
  const clockRef = useRef<Group>(null);

  useFrame((state) => {
    if (clockRef.current) {
      clockRef.current.rotation.z = -state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <group>
      <ParticleField count={80} color="#ef223a" speed={0.05} spread={12} size={0.012} />

      <FloatingText position={[0, 2.8, 0]} fontSize={0.45} color="#ffffff" bold delay={0.2}>
        The Patience Deficit
      </FloatingText>

      {/* Clock face */}
      <group ref={clockRef} position={[0, -0.5, -0.5]}>
        <mesh>
          <ringGeometry args={[1.8, 2, 64]} />
          <meshStandardMaterial color="#ef223a" emissive="#ef223a" emissiveIntensity={0.15} transparent opacity={0.2} />
        </mesh>
        <mesh position={[0, 0.5, 0.1]}>
          <boxGeometry args={[0.03, 1, 0.02]} />
          <meshStandardMaterial color="#ef223a" transparent opacity={0.3} />
        </mesh>
      </group>

      {/* Time cards in 2x2 grid */}
      {cards.map((card, i) => (
        <TimeCard key={i} index={i} time={card.time} label={card.label} x={card.x} y={card.y} />
      ))}

      <FloatingText position={[0, -2.8, 0]} fontSize={0.1} color="#4d5777" delay={1.5}>
        Source: Decoding Digital Patience Report, Twilio
      </FloatingText>

      <SceneAccents count={6} spread={10} seed={6} />
      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={1} distance={8} />
    </group>
  );
}
