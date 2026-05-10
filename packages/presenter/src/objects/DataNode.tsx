import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

interface DataNodeProps {
  position?: [number, number, number];
  scale?: number;
  color?: string;
  pulseSpeed?: number;
}

export function DataNode({
  position = [0, 0, 0],
  scale = 0.15,
  color = '#ef223a',
  pulseSpeed = 2,
}: DataNodeProps) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.01;
      const pulse = 0.8 + Math.sin(state.clock.elapsedTime * pulseSpeed + position[0] * 3) * 0.2;
      ref.current.scale.setScalar(scale * pulse);
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref} scale={scale}>
        <octahedronGeometry args={[1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          wireframe
        />
      </mesh>
      <pointLight color={color} intensity={0.3} distance={2} />
    </group>
  );
}
