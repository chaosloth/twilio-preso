import { FloatingText } from '../objects';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

const chapters = [
  { title: 'The invisible\nextraordinary', subtitle: 'Amazing experiences exist' },
  { title: 'Wonder is\ndesigned', subtitle: 'You are an architect of wonder' },
  { title: 'The lineage\nof builders', subtitle: 'Learn from best builders' },
  { title: 'Foundations\nfor bold ideas', subtitle: 'Get the right tools' },
  { title: 'Build without\nwalls', subtitle: 'Own your own freedom' },
  { title: 'Building for\nwonder', subtitle: 'Build experiences that create wonder' },
];

export default function Stage04StoryArc() {
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      <FloatingText position={[0, 3, 0]} fontSize={0.4} color="#ffffff" bold delay={0}>
        Wonder Story Arc
      </FloatingText>

      {chapters.map((chapter, i) => {
        const angle = (i / chapters.length) * Math.PI - Math.PI / 2;
        const radius = 4;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * 1.5;
        return (
          <group key={i} position={[x, y, -1]}>
            <mesh>
              <boxGeometry args={[1.5, 2.2, 0.1]} />
              <meshStandardMaterial
                color="#0D1B2A"
                emissive="#F22F46"
                emissiveIntensity={0.1}
                transparent
                opacity={0.8}
              />
            </mesh>
            <FloatingText position={[0, 0.3, 0.1]} fontSize={0.12} color="#F22F46" bold delay={0.2 + i * 0.15} maxWidth={1.3}>
              {chapter.title}
            </FloatingText>
            <FloatingText position={[0, -0.7, 0.1]} fontSize={0.08} color="#888888" delay={0.4 + i * 0.15} maxWidth={1.3}>
              {chapter.subtitle}
            </FloatingText>
          </group>
        );
      })}

      <pointLight position={[0, 0, 3]} intensity={0.8} color="#F22F46" distance={10} />
    </group>
  );
}
