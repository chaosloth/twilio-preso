import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type { Mesh } from 'three';

interface GlowingPillarProps {
  label: string;
  sublabel: string;
  position?: [number, number, number];
  color?: string;
  intensity?: number;
}

export function GlowingPillar({
  label,
  sublabel,
  position = [0, 0, 0],
  color = '#ef223a',
  intensity = 1,
}: GlowingPillarProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5 + (position[0] || 0)) * 0.1;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <cylinderGeometry args={[0.3, 0.4, 3, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4 * intensity}
          transparent
          opacity={0.7}
        />
      </mesh>
      <pointLight position={[0, 2, 0]} color={color} intensity={intensity} distance={5} />
      <Text position={[0, 2.2, 0]} fontSize={0.22} color="#ffffff" anchorX="center" fontWeight={700}>
        {label}
      </Text>
      <Text position={[0, -2.2, 0]} fontSize={0.1} color={color} anchorX="center" maxWidth={2.5}>
        {sublabel}
      </Text>
    </group>
  );
}
