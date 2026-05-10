import { FloatingText, ParticleField } from '../objects';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function Stage13Memory() {
  const nodesRef = useRef<Group>(null);

  const nodes = useMemo(() =>
    Array.from({ length: 20 }, () => ({
      x: (Math.random() - 0.5) * 5,
      y: (Math.random() - 0.5) * 3,
      z: (Math.random() - 0.5) * 2,
    })), []);

  useFrame((state) => {
    if (nodesRef.current) {
      nodesRef.current.children.forEach((child, i) => {
        const node = nodes[i];
        if (node) {
          child.position.y = node.y + Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.1;
        }
      });
    }
  });

  return (
    <group>
      <FloatingText position={[0, 3.5, 0]} fontSize={0.45} color="#ef223a" bold delay={0}>
        Conversation Memory
      </FloatingText>
      <FloatingText position={[0, 2.7, 0]} fontSize={0.13} color="#7e869c" delay={0.3}>
        GA
      </FloatingText>

      <FloatingText position={[-3.5, 1.5, 0]} fontSize={0.14} color="#ffffff" delay={0.4} maxWidth={4} anchorX="left">
        AI Agents Get Long-Term Memory
      </FloatingText>
      <FloatingText position={[-3.5, 0.5, 0]} fontSize={0.14} color="#ffffff" delay={0.6} maxWidth={4} anchorX="left">
        Human Agents Get Instant Context
      </FloatingText>
      <FloatingText position={[-3.5, -0.5, 0]} fontSize={0.14} color="#ffffff" delay={0.8} maxWidth={4} anchorX="left">
        Both Get Grounded in Facts
      </FloatingText>

      {/* Neural mesh nodes */}
      <group ref={nodesRef} position={[2, 0, 0]}>
        {nodes.map((node, i) => (
          <mesh key={i} position={[node.x, node.y, node.z]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#ef223a" emissive="#ef223a" emissiveIntensity={1.5} />
          </mesh>
        ))}
      </group>

      <ParticleField count={100} spread={8} color="#ef223a" speed={0.05} size={0.01} position={[2, 0, 0]} />
      <pointLight position={[2, 0, 2]} color="#ef223a" intensity={1.5} distance={6} />
    </group>
  );
}
