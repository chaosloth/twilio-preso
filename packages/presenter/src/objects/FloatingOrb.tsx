import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

interface FloatingOrbProps {
  position?: [number, number, number];
  scale?: number;
  color?: string;
  speed?: number;
}

export function FloatingOrb({
  position = [0, 0, 0],
  scale = 0.3,
  color = '#ef223a',
  speed = 1,
}: FloatingOrbProps) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.elapsedTime * speed + position[0] * 2;
      ref.current.position.y = position[1] + Math.sin(t) * 0.15;
      const mat = ref.current.material as any;
      if (mat) {
        mat.emissiveIntensity = 0.3 + Math.sin(t * 1.5) * 0.2;
      }
    }
  });

  return (
    <mesh ref={ref} position={position} scale={scale}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.4}
        transparent
        opacity={0.4}
      />
    </mesh>
  );
}
