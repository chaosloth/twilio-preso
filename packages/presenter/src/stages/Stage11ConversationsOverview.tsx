import { FloatingText, ParticleField } from '../objects';
import { Text, Billboard } from '@react-three/drei';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';

const NODE_LABELS = ['Intent', 'Participants', 'Context', 'Sentiment', 'Emotion', 'Channel', 'Location', 'Observation', 'Traits', 'NBA', 'Preference', 'Modality'];
const NODE_COLORS = ['#ef223a', '#ffffff', '#babecc', '#7e869c', '#4d5777'];

interface NodeDef {
  pos: [number, number, number];
  color: string;
  pulseSpeed: number;
  size: number;
  label: string | null;
}

interface EdgeDef {
  from: number;
  to: number;
  dashed: boolean;
}

function generateNetwork(): { nodes: NodeDef[]; edges: EdgeDef[] } {
  const nodes: NodeDef[] = [];
  const count = 14;
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2 + (i % 2) * 0.3;
    const radius = 2.2 + (i % 3) * 1.0;
    const y = Math.sin(i * 1.7) * 1.5;
    nodes.push({
      pos: [Math.cos(theta) * radius, y, Math.sin(theta) * radius],
      color: NODE_COLORS[i % NODE_COLORS.length],
      pulseSpeed: 0.8 + (i % 5) * 0.4,
      size: 0.09 + (i % 3) * 0.04,
      label: i < NODE_LABELS.length ? NODE_LABELS[i] : null,
    });
  }

  const edges: EdgeDef[] = [];
  for (let i = 0; i < count; i++) {
    edges.push({ from: i, to: (i + 1) % count, dashed: i % 3 === 0 });
    if (i + 3 < count) edges.push({ from: i, to: i + 3, dashed: i % 2 === 0 });
  }
  edges.push({ from: 0, to: 7, dashed: true });
  edges.push({ from: 2, to: 10, dashed: false });
  edges.push({ from: 5, to: 12, dashed: true });

  return { nodes, edges };
}

function PulsingNode({ pos, color, pulseSpeed, size, label }: NodeDef) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    if (ref.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * pulseSpeed) * 0.15;
      ref.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={pos}>
      <mesh ref={ref}>
        <sphereGeometry args={[size, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>
      {label && (
        <Billboard position={[0, size + 0.15, 0]}>
          <Text
            fontSize={0.14}
            color={color}
            anchorX="center"
            anchorY="bottom"
            font="/fonts/SpaceGrotesk-Regular.ttf"
          >
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

function NetworkEdge({ from, to, dashed, timeOffset }: { from: [number, number, number]; to: [number, number, number]; dashed: boolean; timeOffset: number }) {
  const ref = useRef<Mesh>(null);

  const { midpoint, length, rotation } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const dir = end.clone().sub(start);
    const len = dir.length();
    const quat = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    quat.setFromUnitVectors(up, dir.normalize());
    const rot = new THREE.Euler().setFromQuaternion(quat);
    return { midpoint: mid, length: len, rotation: rot };
  }, [from, to]);

  useFrame((state) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 2 + timeOffset) * 0.2;
    }
  });

  return (
    <mesh ref={ref} position={midpoint} rotation={rotation}>
      <cylinderGeometry args={[0.008, 0.008, length, 4]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={0.5}
        transparent
        opacity={0.4}
        {...(dashed ? { wireframe: true } : {})}
      />
    </mesh>
  );
}

export default function Stage11ConversationsOverview() {
  const groupRef = useRef<Group>(null);
  const { nodes, edges } = useMemo(() => generateNetwork(), []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.08;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.1;
    }
  });

  return (
    <group>
      <FloatingText position={[0, 3, 0]} fontSize={0.4} color="#ffffff" bold delay={0.2} maxWidth={10}>
        Twilio Conversations
      </FloatingText>
      <FloatingText position={[0, 2.3, 0]} fontSize={0.18} color="#babecc" delay={0.4} maxWidth={10}>
        A foundation for driving customer lifetime value through every interaction
      </FloatingText>

      <group ref={groupRef} position={[0, -0.3, 0]}>
        {nodes.map((node, i) => (
          <PulsingNode key={i} {...node} />
        ))}
        {edges.map((edge, i) => (
          <NetworkEdge
            key={i}
            from={nodes[edge.from].pos}
            to={nodes[edge.to].pos}
            dashed={edge.dashed}
            timeOffset={i * 0.7}
          />
        ))}
      </group>

      <ParticleField count={80} spread={14} color="#ef223a" speed={0.04} size={0.012} />
      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={0.8} distance={10} />
    </group>
  );
}
