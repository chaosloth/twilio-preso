import { FloatingText, ParticleField } from '../objects';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function Stage08Siloes() {
  const islandsRef = useRef<Group>(null);

  useFrame((state) => {
    if (islandsRef.current) {
      islandsRef.current.children.forEach((child, i) => {
        child.position.y += Math.sin(state.clock.elapsedTime * 0.3 + i * 2) * 0.001;
      });
    }
  });

  const islands = [
    { label: 'SMS', x: -3.5, y: 1.5 },
    { label: 'Voice', x: 3, y: 0.5 },
    { label: 'Email', x: -1, y: -2 },
    { label: 'Chat', x: 3.5, y: -1.5 },
    { label: 'Social', x: -3, y: -1 },
  ];

  return (
    <group>
      <FloatingText position={[0, 3.5, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={10}>
        {'The result for employees\nand customers is siloes.'}
      </FloatingText>

      <group ref={islandsRef}>
        {islands.map((island, i) => (
          <group key={island.label} position={[island.x, island.y, 0]}>
            <mesh>
              <boxGeometry args={[1.8, 1, 0.3]} />
              <meshStandardMaterial
                color="#0f1525"
                emissive="#F22F46"
                emissiveIntensity={0.05}
              />
            </mesh>
            <FloatingText position={[0, 0, 0.2]} fontSize={0.15} color="#F22F46" delay={0.3 + i * 0.15}>
              {island.label}
            </FloatingText>
          </group>
        ))}
      </group>

      {/* Broken connections - red dashed lines that don't connect */}
      <ParticleField count={150} spread={10} color="#F22F46" speed={0.02} size={0.015} />
    </group>
  );
}
