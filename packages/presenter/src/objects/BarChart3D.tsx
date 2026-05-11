import { useRef, useEffect } from 'react';
import { Text } from '@react-three/drei';
import gsap from 'gsap';
import type { Group } from 'three';

interface BarChart3DProps {
  data: Record<string, number>;
  position?: [number, number, number];
  maxHeight?: number;
  barWidth?: number;
  color?: string;
}

function Bar({ targetHeight, x, label, value, color, barWidth }: { targetHeight: number; x: number; label: string; value: number; color: string; barWidth: number }) {
  const groupRef = useRef<Group>(null);
  const scaleRef = useRef({ y: 0.01 });

  useEffect(() => {
    gsap.to(scaleRef.current, {
      y: Math.max(targetHeight, 0.01),
      duration: 0.8,
      ease: 'back.out(1.5)',
      onUpdate: () => {
        if (groupRef.current) {
          groupRef.current.scale.y = scaleRef.current.y;
        }
      },
    });
  }, [targetHeight]);

  return (
    <group position={[x, 0, 0]}>
      {/* Label at bottom — always visible */}
      <Text position={[0, -0.3, 0.1]} fontSize={0.18} color="#babecc" anchorX="center" anchorY="top" maxWidth={barWidth + 0.8}>
        {label}
      </Text>

      {/* Bar container — scales Y from bottom (y=0 is the base) */}
      <group ref={groupRef} position={[0, 0, 0]} scale={[1, 0.01, 1]}>
        {/* Bar geometry offset so bottom is at y=0 */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[barWidth, 1, 0.3]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* Count above the bar */}
      {value > 0 && (
        <Text position={[0, targetHeight + 0.2, 0.1]} fontSize={0.25} color={color} anchorX="center" fontWeight={700}>
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
  color = '#ef223a',
}: BarChart3DProps) {
  const entries = Object.entries(data);
  const maxValue = Math.max(...Object.values(data), 1);
  const gap = 0.6;
  const totalWidth = entries.length * (barWidth + gap);

  return (
    <group position={position}>
      {entries.map(([label, value], i) => {
        const targetHeight = (value / maxValue) * maxHeight;
        const x = i * (barWidth + gap) - totalWidth / 2 + (barWidth + gap) / 2;
        return <Bar key={label} targetHeight={targetHeight} x={x} label={label} value={value} color={color} barWidth={barWidth} />;
      })}
    </group>
  );
}
