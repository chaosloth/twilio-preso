import { FloatingText, ParticleField, SceneAccents } from '../objects';
import { Html } from '@react-three/drei';
import { useIsStageActive } from '../components/Stage';
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import type { Group } from 'three';

const chapters = [
  { title: 'The invisible\nextraordinary' },
  { title: 'Wonder is\ndesigned' },
  { title: 'The lineage\nof builders' },
  { title: 'Foundations\nfor bold ideas' },
  { title: 'Build without\nwalls' },
  { title: 'Building for\nwonder' },
];

function ChapterCard({ index, title, targetX, active }: { index: number; title: string; targetX: number; active: boolean }) {
  const ref = useRef<Group>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.position.x = 0;
    ref.current.scale.set(0, 0, 0);
    gsap.to(ref.current.position, {
      x: targetX,
      duration: 0.8,
      delay: 0.3 + index * 0.15,
      ease: 'back.out(1.2)',
    });
    gsap.to(ref.current.scale, {
      x: 1, y: 1, z: 1,
      duration: 0.6,
      delay: 0.3 + index * 0.15,
      ease: 'back.out(1.5)',
    });
  }, [index, targetX]);

  // Ongoing gentle float animation
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.8 + index * 1.2) * 0.08;
      ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5 + index * 0.9) * 0.02;
    }
  });

  return (
    <group ref={ref} position={[0, 0, 0]}>
      {/* Sparkle glow behind card */}
      <pointLight
        position={[0, 0, -0.2]}
        color="#ef223a"
        intensity={0.4 + Math.sin(index * 2) * 0.2}
        distance={1.5}
      />
      <Html center transform>
        <div className={`chapter-card card-${index}`} style={{
          width: 70,
          height: 100,
          background: '#000d25',
          borderRadius: 10,
          padding: '10px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          border: '2px solid rgba(239, 34, 58, 0.4)',
          boxShadow: '0 0 12px rgba(239, 34, 58, 0.2), inset 0 0 8px rgba(239, 34, 58, 0.05)',
          animation: `shimmer 3s ease-in-out ${index * 0.5}s infinite`,
        }}>
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#ef223a',
            fontFamily: "'Space Grotesk', sans-serif",
            marginBottom: 6,
          }}>
            {index + 1}
          </div>
          <div style={{
            fontSize: 9,
            color: '#ffffff',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 500,
            textAlign: 'center',
            lineHeight: 1.3,
            whiteSpace: 'pre-line',
          }}>
            {title}
          </div>
        </div>
        <style>{`
          @keyframes shimmer {
            0%, 100% { border-color: rgba(239, 34, 58, 0.4); box-shadow: 0 0 12px rgba(239, 34, 58, 0.2), inset 0 0 8px rgba(239, 34, 58, 0.05); }
            50% { border-color: rgba(239, 34, 58, 0.7); box-shadow: 0 0 20px rgba(239, 34, 58, 0.4), inset 0 0 12px rgba(239, 34, 58, 0.1); }
          }
        `}</style>
      </Html>
    </group>
  );
}

export default function Stage04StoryArc() {
  const active = useIsStageActive();
  const gap = 2;
  const totalWidth = (chapters.length - 1) * gap;
  const startX = -totalWidth / 2;

  return (
    <group>
      <ParticleField count={60} spread={14} color="#ef223a" speed={0.05} size={0.012} />

      <FloatingText position={[0, 3, 0]} fontSize={0.5} color="#ffffff" bold delay={0}>
        Wonder Story Arc
      </FloatingText>

      {chapters.map((chapter, i) => (
        <ChapterCard
          key={i}
          index={i}
          title={chapter.title}
          targetX={startX + i * gap}
          active={active}
        />
      ))}

      <SceneAccents count={6} spread={14} seed={4} />
      <pointLight position={[0, 3, 3]} intensity={1} color="#ffffff" distance={10} />
    </group>
  );
}
