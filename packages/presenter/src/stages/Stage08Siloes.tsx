import { FloatingText, ParticleField, SceneAccents } from '../objects';
import { Html } from '@react-three/drei';
import { useIsStageActive } from '../components/Stage';
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import type { Group } from 'three';

const islands = [
  { label: 'SMS' },
  { label: 'Voice' },
  { label: 'Email' },
  { label: 'Chat' },
  { label: 'Social' },
];

function SiloCard({ label, targetX, index, active }: { label: string; targetX: number; index: number; active: boolean }) {
  const ref = useRef<Group>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.position.x = 0;
    ref.current.scale.set(0, 0, 0);
    gsap.to(ref.current.position, {
      x: targetX,
      duration: 0.7,
      delay: 0.3 + index * 0.12,
      ease: 'back.out(1.2)',
    });
    gsap.to(ref.current.scale, {
      x: 1, y: 1, z: 1,
      duration: 0.5,
      delay: 0.3 + index * 0.12,
      ease: 'back.out(1.5)',
    });
  }, [index, targetX]);

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = -0.3 + Math.sin(state.clock.elapsedTime * 0.5 + index * 1.3) * 0.05;
    }
  });

  return (
    <group ref={ref} position={[0, -0.3, 0]}>
      <pointLight position={[0, 0, -0.2]} color="#ef223a" intensity={0.3} distance={1.2} />
      <Html center transform>
        <div style={{
          width: 80,
          height: 70,
          background: '#000d25',
          borderRadius: 10,
          padding: '10px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid rgba(239, 34, 58, 0.4)',
          boxShadow: '0 0 12px rgba(239, 34, 58, 0.2)',
          animation: `shimmer 3s ease-in-out ${index * 0.4}s infinite`,
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#ef223a',
            fontFamily: "'Space Grotesk', sans-serif",
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
      </Html>
    </group>
  );
}

export default function Stage08Siloes() {
  const active = useIsStageActive();
  const gap = 1.8;
  const totalWidth = (islands.length - 1) * gap;
  const startX = -totalWidth / 2;

  return (
    <group>
      <FloatingText position={[0, 2.8, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={10}>
        {'The result for employees\nand customers is siloes.'}
      </FloatingText>

      {islands.map((island, i) => (
        <SiloCard
          key={island.label}
          label={island.label}
          targetX={startX + i * gap}
          index={i}
          active={active}
        />
      ))}

      <ParticleField count={60} spread={10} color="#ef223a" speed={0.02} size={0.012} />
      <pointLight position={[0, 0, 3]} color="#ef223a" intensity={0.6} distance={8} />
    </group>
  );
}
