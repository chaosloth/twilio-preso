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
      {/* Bar grows upward from baseline */}
      <mesh ref={meshRef} position={[0, 0, 0]} scale={[1, 0.01, 1]}>
        <boxGeometry args={[barWidth, 1, 0.3]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {/* Count always above the bar */}
      {value > 0 && (
        <Text position={[0, height + 0.3, 0]} fontSize={0.25} color={color} anchorX="center" fontWeight={700}>
          {String(value)}
        </Text>
      )}
      {/* Label always below, fixed position */}
      <Text position={[0, -0.6, 0]} fontSize={0.16} color="#babecc" anchorX="center" anchorY="top" maxWidth={barWidth + 0.5}>
        {label}
      </Text>
    </group>
  );
}

export function BarChart3D({
  data,
  position = [0, 0, 0],
  maxHeight = 3,
  barWidth = 0.8,
  color = '#ef223a',
}: BarChart3DProps) {
  const entries = Object.entries(data);
  const maxValue = Math.max(...Object.values(data), 1);
  const gap = 0.6;
  const totalWidth = entries.length * (barWidth + gap);

  return (
    <group position={position}>
      {entries.map(([label, value], i) => {
        const height = (value / maxValue) * maxHeight;
        const x = i * (barWidth + gap) - totalWidth / 2 + (barWidth + gap) / 2;
        return <Bar key={label} height={height} x={x} label={label} value={value} color={color} barWidth={barWidth} />;
      })}
    </group>
  );
}
