import { useRef, useEffect } from 'react';
import { Text } from '@react-three/drei';
import gsap from 'gsap';
import type { Mesh } from 'three';

interface BarChart3DProps {
  data: Record<string, number>;
  position?: [number, number, number];
  maxHeight?: number;
  barWidth?: number;
  color?: string;
}

function Bar({ height, x, label, value, color, barWidth }: { height: number; x: number; label: string; value: number; color: string; barWidth: number }) {
  const meshRef = useRef<Mesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;
    gsap.to(meshRef.current.scale, { y: Math.max(height, 0.01), duration: 0.6, ease: 'back.out(1.5)' });
  }, [height]);

  return (
    <group position={[x, 0, 0]}>
      <mesh ref={meshRef} position={[0, 0.5, 0]} scale={[1, 0.01, 1]}>
        <boxGeometry args={[barWidth, 1, 0.3]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <Text position={[0, -0.4, 0]} fontSize={0.12} color="#ffffff" anchorX="center" maxWidth={barWidth + 0.3}>
        {label}
      </Text>
      {value > 0 && (
        <Text position={[0, height + 0.3, 0]} fontSize={0.18} color={color} anchorX="center">
          {String(value)}
        </Text>
      )}
    </group>
  );
}

export function BarChart3D({
  data,
  position = [0, 0, 0],
  maxHeight = 3,
  barWidth = 0.8,
  color = '#F22F46',
}: BarChart3DProps) {
  const entries = Object.entries(data);
  const maxValue = Math.max(...Object.values(data), 1);
  const totalWidth = entries.length * (barWidth + 0.4);

  return (
    <group position={position}>
      {entries.map(([label, value], i) => {
        const height = (value / maxValue) * maxHeight;
        const x = i * (barWidth + 0.4) - totalWidth / 2 + barWidth / 2;
        return <Bar key={label} height={height} x={x} label={label} value={value} color={color} barWidth={barWidth} />;
      })}
    </group>
  );
}
