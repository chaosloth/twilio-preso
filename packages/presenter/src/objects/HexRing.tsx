import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

interface HexRingProps {
  position?: [number, number, number];
  scale?: number;
  color?: string;
  rotationSpeed?: number;
  tilt?: number;
}

export function HexRing({
  position = [0, 0, 0],
  scale = 1,
  color = '#F22F46',
  rotationSpeed = 0.3,
  tilt = 0.4,
}: HexRingProps) {
  const ref = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.z += delta * rotationSpeed;
      ref.current.rotation.x += delta * rotationSpeed * 0.3;
    }
  });

  return (
    <mesh ref={ref} position={position} scale={scale} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[1, 0.03, 6, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.8}
        wireframe
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}
