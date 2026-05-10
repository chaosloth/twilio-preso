import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D } from 'three';

interface ParticleFieldProps {
  count?: number;
  spread?: number;
  color?: string;
  speed?: number;
  size?: number;
  position?: [number, number, number];
}

export function ParticleField({
  count = 500,
  spread = 10,
  color = '#F22F46',
  speed = 0.3,
  size = 0.02,
  position = [0, 0, 0],
}: ParticleFieldProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread,
      z: (Math.random() - 0.5) * spread * 0.5,
      vx: (Math.random() - 0.5) * speed * 0.01,
      vy: (Math.random() - 0.5) * speed * 0.01,
      vz: (Math.random() - 0.5) * speed * 0.005,
    }));
  }, [count, spread, speed]);

  useFrame(() => {
    if (!meshRef.current) return;
    particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      if (Math.abs(p.x) > spread / 2) p.vx *= -1;
      if (Math.abs(p.y) > spread / 2) p.vy *= -1;
      if (Math.abs(p.z) > spread / 2) p.vz *= -1;

      dummy.position.set(p.x, p.y, p.z);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} position={position}>
      <sphereGeometry args={[size, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </instancedMesh>
  );
}
