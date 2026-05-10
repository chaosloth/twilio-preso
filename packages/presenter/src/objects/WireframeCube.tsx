import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

interface WireframeCubeProps {
  position?: [number, number, number];
  scale?: number;
  color?: string;
  rotationSpeed?: number;
}

export function WireframeCube({
  position = [0, 0, 0],
  scale = 0.4,
  color = '#F22F46',
  rotationSpeed = 0.2,
}: WireframeCubeProps) {
  const ref = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x += delta * rotationSpeed;
      ref.current.rotation.y += delta * rotationSpeed * 0.7;
    }
  });

  return (
    <mesh ref={ref} position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        wireframe
        transparent
        opacity={0.5}
      />
    </mesh>
  );
}
