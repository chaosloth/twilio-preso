import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Shape, type Mesh } from 'three';

function createGemShape(): Shape {
  const shape = new Shape();
  shape.moveTo(-2, 1.2);
  shape.lineTo(-1.5, 2);
  shape.lineTo(1.8, 2.1);
  shape.lineTo(2.2, 0.8);
  shape.lineTo(1.8, -1.8);
  shape.lineTo(-0.5, -2.1);
  shape.lineTo(-2.2, -0.8);
  shape.closePath();
  return shape;
}

interface TwilioGemProps {
  scale?: number;
  color?: string;
  wireframe?: boolean;
  rotationSpeed?: number;
  emissiveIntensity?: number;
  position?: [number, number, number];
}

export function TwilioGem({
  scale = 1,
  color = '#F22F46',
  wireframe = true,
  rotationSpeed = 0.2,
  emissiveIntensity = 0.5,
  position = [0, 0, 0],
}: TwilioGemProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * rotationSpeed;
    }
  });

  return (
    <mesh ref={meshRef} scale={scale} position={position}>
      <shapeGeometry args={[createGemShape()]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        wireframe={wireframe}
        transparent
        opacity={wireframe ? 0.8 : 1}
      />
    </mesh>
  );
}
