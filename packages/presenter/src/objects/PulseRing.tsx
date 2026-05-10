import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

interface PulseRingProps {
  position?: [number, number, number];
  color?: string;
  speed?: number;
  maxScale?: number;
}

export function PulseRing({
  position = [0, 0, 0],
  color = '#F22F46',
  speed = 0.8,
  maxScale = 3,
}: PulseRingProps) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    if (ref.current) {
      const t = (state.clock.elapsedTime * speed) % 1;
      const scale = 0.5 + t * (maxScale - 0.5);
      ref.current.scale.set(scale, scale, 1);
      const mat = ref.current.material as any;
      if (mat) {
        mat.opacity = (1 - t) * 0.6;
      }
    }
  });

  return (
    <mesh ref={ref} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1, 0.015, 8, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}
