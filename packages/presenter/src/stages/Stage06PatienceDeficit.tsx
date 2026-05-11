import { FloatingText, ParticleField, SceneAccents } from '../objects';
import { Html } from '@react-three/drei';
import { useIsStageActive } from '../components/Stage';
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import type { Group } from 'three';

const cards = [
  { time: '+1 min', label: 'Financial disputes' },
  { time: '+7 min', label: 'Troubleshooting' },
  { time: '+2 min', label: 'Loan/policy' },
  { time: '+8 min', label: 'Travel compensation' },
];

function TimeCard({ time, label, targetX, targetY, index, active }: { time: string; label: string; targetX: number; targetY: number; index: number; active: boolean }) {
  const ref = useRef<Group>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.position.set(0, 0, 0);
    ref.current.scale.set(0, 0, 0);
    gsap.to(ref.current.position, {
      x: targetX,
      y: targetY,
      duration: 0.7,
      delay: 0.4 + index * 0.15,
      ease: 'back.out(1.2)',
    });
    gsap.to(ref.current.scale, {
      x: 1, y: 1, z: 1,
      duration: 0.5,
      delay: 0.4 + index * 0.15,
      ease: 'back.out(1.5)',
    });
  }, [index, targetX, targetY]);

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = targetY + Math.sin(state.clock.elapsedTime * 0.6 + index * 1.5) * 0.05;
    }
  });

  return (
    <group ref={ref} position={[0, 0, 0]}>
      <pointLight position={[0, 0, -0.2]} color="#ef223a" intensity={0.3} distance={1.5} />
      {active && <Html center transform>
        <div style={{
          width: 110,
          height: 80,
          background: '#000d25',
          borderRadius: 12,
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid rgba(239, 34, 58, 0.4)',
          boxShadow: '0 0 12px rgba(239, 34, 58, 0.2)',
          animation: `shimmer 3s ease-in-out ${index * 0.5}s infinite`,
        }}>
          <div style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#ef223a',
            fontFamily: "'Space Grotesk', sans-serif",
            marginBottom: 4,
          }}>
            {time}
          </div>
          <div style={{
            fontSize: 11,
            color: '#babecc',
            fontFamily: "'Space Grotesk', sans-serif",
            textAlign: 'center',
          }}>
            {label}
          </div>
        </div>
        <style>{`
          @keyframes shimmer {
            0%, 100% { border-color: rgba(239, 34, 58, 0.4); box-shadow: 0 0 12px rgba(239, 34, 58, 0.2); }
            50% { border-color: rgba(239, 34, 58, 0.7); box-shadow: 0 0 20px rgba(239, 34, 58, 0.4); }
          }
        `}</style>
      </Html>}
    </group>
  );
}

export default function Stage06PatienceDeficit() {
  const active = useIsStageActive();
  const clockRef = useRef<Group>(null);

  useFrame((state) => {
    if (clockRef.current) {
      clockRef.current.rotation.z = -state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <group>
      <ParticleField count={60} color="#ef223a" speed={0.05} spread={12} size={0.012} />

      <FloatingText position={[0, 2.8, 0]} fontSize={0.45} color="#ffffff" bold delay={0.2}>
        The Patience Deficit
      </FloatingText>

      {/* Clock face - left third */}
      <group ref={clockRef} position={[-3.5, -0.3, 0]}>
        <mesh>
          <ringGeometry args={[1.2, 1.4, 64]} />
          <meshStandardMaterial color="#ef223a" emissive="#ef223a" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 0.4, 0.1]}>
          <boxGeometry args={[0.04, 0.8, 0.02]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* Time cards in 2x2 grid - right two thirds */}
      <TimeCard time={cards[0].time} label={cards[0].label} targetX={0.8} targetY={0.8} index={0} active={active} />
      <TimeCard time={cards[1].time} label={cards[1].label} targetX={3.8} targetY={0.8} index={1} active={active} />
      <TimeCard time={cards[2].time} label={cards[2].label} targetX={0.8} targetY={-1.5} index={2} active={active} />
      <TimeCard time={cards[3].time} label={cards[3].label} targetX={3.8} targetY={-1.5} index={3} active={active} />

      <FloatingText position={[0, -2.8, 0]} fontSize={0.1} color="#4d5777" delay={1.5}>
        Source: Decoding Digital Patience Report, Twilio
      </FloatingText>

      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={1} distance={8} />
    </group>
  );
}
