import { FloatingText, ParticleField, SceneAccents } from '../objects';
import { Html } from '@react-three/drei';
import { useRef, useEffect } from 'react';
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

function ChapterCard({ index, title, targetX }: { index: number; title: string; targetX: number }) {
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

  return (
    <group ref={ref} position={[0, 0, 0]}>
      <Html center transform>
        <div style={{
          width: 160,
          height: 200,
          background: '#0a1e3d',
          borderRadius: 16,
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          border: '1px solid rgba(239, 34, 58, 0.15)',
        }}>
          <div style={{
            fontSize: 42,
            fontWeight: 700,
            color: '#ef223a',
            fontFamily: "'Tektur', sans-serif",
            marginBottom: 12,
          }}>
            {index + 1}
          </div>
          <div style={{
            fontSize: 15,
            color: '#ffffff',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            textAlign: 'center',
            lineHeight: 1.4,
            whiteSpace: 'pre-line',
          }}>
            {title}
          </div>
        </div>
      </Html>
    </group>
  );
}

export default function Stage04StoryArc() {
  const gap = 2.3;
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
        />
      ))}

      <SceneAccents count={6} spread={14} seed={4} />
      <pointLight position={[0, 3, 3]} intensity={1} color="#ffffff" distance={10} />
    </group>
  );
}
